import { beforeEach, expect, it, vi } from "vitest";
import { DashboardSiteService } from "./DashboardSiteService";
import { GscService } from "@/server/features/gsc/services/GscService";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import { GscConnectionRepository } from "@/server/features/gsc/repositories/GscConnectionRepository";

const providers = vi.hoisted(() => ({ domains: vi.fn(), links: vi.fn() }));
vi.mock("@/server/lib/dataforseo", async () => ({
  ...(await import("@/server/lib/dataforseoBacklinksTarget")),
  createDataforseoClient: () => ({
    backlinks: { referringDomains: providers.domains, rows: providers.links },
  }),
}));
vi.mock("@/server/features/gsc/repositories/GscConnectionRepository", () => ({
  GscConnectionRepository: { getByProjectId: vi.fn() },
}));
vi.mock("@/server/features/gsc/services/GscService", async () => ({
  ...(await import("@/server/lib/gscErrors")),
  GscService: { getPerformance: vi.fn() },
  isExpectedGrantFailure: () => false,
}));
const stored = vi.hoisted(() => ({
  finalizedThrough: vi.fn(),
  totals: vi.fn(),
}));
vi.mock("@/server/features/metrics-history/MetricsHistoryRepository", () => ({
  MetricsHistoryRepository: {
    getGscCoverageEnd: stored.finalizedThrough,
    getGscQueryTotals: stored.totals,
  },
}));
vi.mock("./DashboardCacheService", () => ({
  DashboardCacheService: {
    readThrough: async (input: { load: () => Promise<unknown> }) => ({
      value: await input.load(),
    }),
  },
}));

const performanceBase = {
  siteUrl: "sc-domain:example.com",
  connectedBy: null,
  request: { startDate: "2026-09-01", endDate: "2026-10-01" },
};

beforeEach(() => {
  stored.finalizedThrough.mockReset().mockResolvedValue(null);
  stored.totals.mockReset().mockResolvedValue([]);
  providers.domains.mockResolvedValue({ items: [] });
  providers.links.mockResolvedValue({ items: [] });
  vi.mocked(GscConnectionRepository.getByProjectId).mockResolvedValue({
    id: "connection",
    projectId: "project",
    organizationId: "org",
    siteUrl: "sc-domain:example.com",
    connectedByUserId: "user",
    gscAccountId: "account",
    connectedAccountEmail: null,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  });
  vi.mocked(GscService.getPerformance).mockResolvedValue({
    ...performanceBase,
    rows: [],
  });
});
const row = (query: string, impressions = 10) => ({
  keys: [query],
  clicks: 0,
  impressions,
  ctr: 0,
  position: 12,
});

it("surfaces only queries above the threshold and absent from baseline data", async () => {
  vi.mocked(GscService.getPerformance)
    .mockResolvedValueOnce({
      ...performanceBase,
      rows: [row("new"), row("existing"), row("too small", 9)],
    })
    .mockResolvedValueOnce({ ...performanceBase, rows: [row("existing")] });
  const result = await DashboardSiteService.getEmergingQueries(
    "project",
    "org",
  );
  expect(result.value.rows.map((item) => item.query)).toEqual(["new"]);
});

it("checks capped baseline candidates directly so omitted older queries are not called new", async () => {
  vi.mocked(GscService.getPerformance)
    .mockResolvedValueOnce({
      ...performanceBase,
      rows: [row("older low-click query"), row("new query")],
    })
    .mockResolvedValueOnce({
      ...performanceBase,
      rows: Array.from({ length: 25000 }, (_, index) =>
        row(`baseline ${index}`),
      ),
    })
    .mockResolvedValueOnce({
      ...performanceBase,
      rows: [row("older low-click query")],
    })
    .mockResolvedValueOnce({ ...performanceBase, rows: [] });
  const result = await DashboardSiteService.getEmergingQueries(
    "project",
    "org",
  );
  expect(result.value.rows.map((item) => item.query)).toEqual(["new query"]);
});

const customer = {
  organizationId: "org",
  userId: "user",
  userEmail: "user@example.com",
};
it("shows new referring domains without paying for a fallback backlink request", async () => {
  providers.domains.mockResolvedValue({
    items: [{ domain: "new.example", backlinks: 2 }],
  });
  const result = await DashboardSiteService.getLinkActivity(
    "example.com",
    customer,
  );
  expect(result).toMatchObject({
    kind: "domains",
    value: [{ domain: "new.example", backlinks: 2 }],
  });
  expect(providers.links).not.toHaveBeenCalled();
});
it("falls back to new backlinks when there are no new referring domains", async () => {
  providers.links.mockResolvedValue({
    items: [{ url_from: "https://existing.example/new-page" }],
  });
  const result = await DashboardSiteService.getLinkActivity(
    "example.com",
    customer,
  );
  expect(result).toMatchObject({
    kind: "links",
    links: [{ urlFrom: "https://existing.example/new-page" }],
  });
});

it("finds new queries beyond Google's default first page", async () => {
  vi.mocked(GscService.getPerformance).mockImplementationOnce(
    async (input) => ({
      ...performanceBase,
      rows: input.rowLimit === 25000 ? [row("new zero-click query")] : [],
    }),
  );
  const result = await DashboardSiteService.getEmergingQueries(
    "project",
    "org",
  );
  expect(result.value.rows.map((item) => item.query)).toEqual([
    "new zero-click query",
  ]);
});

it("lists the site's Search Console keywords with Google's position, without a provider request", async () => {
  vi.mocked(GscService.getPerformance).mockResolvedValue({
    ...performanceBase,
    rows: [row("existing keyword", 123)],
  });
  const result = await DashboardSiteService.getKeywords("project", "org");
  expect(result.value.rows).toEqual([
    { query: "existing keyword", clicks: 0, impressions: 123, position: 12 },
  ]);
  expect(providers.domains).not.toHaveBeenCalled();
  expect(providers.links).not.toHaveBeenCalled();
});

const totalsRow = (query: string, impressions: number) => ({
  query,
  clicks: 1,
  impressions,
  position: 4.2,
});

it("lists keywords from stored rows when finalized coverage reaches the window end", async () => {
  stored.finalizedThrough.mockResolvedValue("2999-01-01");
  stored.totals.mockResolvedValue([totalsRow("stored keyword", 50)]);
  const result = await DashboardSiteService.getKeywords("project", "org");
  expect(result.value.rows).toEqual([totalsRow("stored keyword", 50)]);
  expect(GscService.getPerformance).not.toHaveBeenCalled();
  expect(stored.totals).toHaveBeenCalledWith(
    "project",
    expect.any(String),
    expect.any(String),
    { finalizedOnly: false },
  );
});

it("opens the stored path with the ingest's real coverage: newest stored day is 3 days back, same as the window end", async () => {
  // The ingest stores GSC through today-3 and only marks rows finalized at
  // today-5. The gate must key on coverage, not on the finalized flag, or it
  // never opens (caught in review 2026-10-16).
  const { endDate } = resolveDateRange({ dateRange: "last_28_days" });
  stored.finalizedThrough.mockResolvedValue(endDate);
  stored.totals.mockResolvedValue([totalsRow("stored keyword", 50)]);
  const result = await DashboardSiteService.getKeywords("project", "org");
  expect(result.value.source).toBe("stored");
  expect(GscService.getPerformance).not.toHaveBeenCalled();
});

it("falls back to live keywords when finalized coverage is older than the window end", async () => {
  stored.finalizedThrough.mockResolvedValue("2000-01-01");
  const result = await DashboardSiteService.getKeywords("project", "org");
  expect(result.value.rows).toEqual([]);
  expect(GscService.getPerformance).toHaveBeenCalledTimes(1);
  expect(stored.totals).not.toHaveBeenCalled();
});

it("derives emerging queries from stored rows, filtering, sorting and capping at 25", async () => {
  stored.finalizedThrough.mockResolvedValue("2999-01-01");
  const recent = [
    totalsRow("existing", 500),
    totalsRow("too small", 9),
    ...Array.from({ length: 30 }, (_, i) => totalsRow(`new ${i}`, 100 + i)),
  ];
  stored.totals
    .mockResolvedValueOnce(recent)
    .mockResolvedValueOnce([totalsRow("existing", 5)]);
  const result = await DashboardSiteService.getEmergingQueries(
    "project",
    "org",
  );
  expect(GscService.getPerformance).not.toHaveBeenCalled();
  expect(result.value.hasSearchData).toBe(true);
  expect(result.value.rows).toHaveLength(25);
  expect(result.value.rows[0]?.query).toBe("new 29");
  expect(result.value.rows.map((r) => r.query)).not.toContain("existing");
  expect(result.value.rows.map((r) => r.query)).not.toContain("too small");
});

it("reports no search data for stored emerging queries when the recent window is empty", async () => {
  stored.finalizedThrough.mockResolvedValue("2999-01-01");
  const result = await DashboardSiteService.getEmergingQueries(
    "project",
    "org",
  );
  expect(result.value).toMatchObject({ hasSearchData: false, rows: [] });
  expect(GscService.getPerformance).not.toHaveBeenCalled();
});

it("falls back to live emerging queries when finalized coverage is stale", async () => {
  stored.finalizedThrough.mockResolvedValue("2000-01-01");
  await DashboardSiteService.getEmergingQueries("project", "org");
  expect(GscService.getPerformance).toHaveBeenCalledTimes(2);
  expect(stored.totals).not.toHaveBeenCalled();
});
