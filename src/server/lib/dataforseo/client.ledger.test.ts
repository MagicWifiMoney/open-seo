import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb, state, isHostedMock } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } =
    await import("@/server/features/metrics-history/metricsHistoryTestDb");
  return {
    testDb: await createMetricsHistoryTestDb(),
    state: { failWrites: false },
    isHostedMock: vi.fn(),
  };
});

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
  waitUntil: vi.fn(),
}));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({
  runBatch: (...args: Parameters<typeof testDb.runBatch>) => {
    if (state.failWrites) throw new Error("db down");
    return testDb.runBatch(...args);
  },
}));
vi.mock("@/server/lib/runtime-env", () => ({
  isHostedServerAuthMode: isHostedMock,
}));
vi.mock("@/server/billing/autumn", () => ({
  autumn: {},
  AUTUMN_TRACK_RETRY_OPTIONS: {},
}));
vi.mock("@/server/lib/posthog", () => ({ captureServerEvent: vi.fn() }));
vi.mock("@/server/lib/dataforseo/backlinks", () => ({
  fetchBacklinksSummary: vi.fn(),
  fetchBacklinksRows: vi.fn(),
  fetchReferringDomains: vi.fn(),
  fetchDomainPagesSummary: vi.fn(),
  fetchBacklinksHistory: vi.fn(),
  BACKLINKS_DEFAULT_LIMIT: 100,
}));

import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { fetchBacklinksSummary } from "@/server/lib/dataforseo/backlinks";
import { DataforseoChargedTaskError } from "@/server/lib/dataforseo/envelope";
import { CostLedgerRepository } from "@/server/features/costs/CostLedgerRepository";

const customer = {
  organizationId: "organization",
  userId: "user_1",
  userEmail: "a@example.com",
  projectId: "project",
};
const path = ["v3", "backlinks", "summary", "live"];
const listAll = () =>
  CostLedgerRepository.listByProject("project", {
    from: "2000-01-01",
    to: "2999-12-31",
  });

beforeEach(async () => {
  state.failWrites = false;
  isHostedMock.mockResolvedValue(false);
  vi.mocked(fetchBacklinksSummary).mockReset();
  await testDb.seedProject();
});

describe("cost ledger metering (self-host)", () => {
  it("writes one row per billed call with cost, path, run and result count", async () => {
    vi.mocked(fetchBacklinksSummary).mockResolvedValue({
      data: { rank: 42 },
      billing: { costUsd: 0.02, path, resultCount: 3 },
    });
    const client = createDataforseoClient(customer, {
      source: "site_audit",
      runId: "audit-1",
      runKind: "audit",
      operation: "Probe",
      requestSummary: { target: "example.com" },
    });
    expect(await client.backlinks.summary({ target: "example.com" })).toEqual({
      rank: 42,
    });
    const [row] = await listAll();
    expect(row).toMatchObject({
      projectId: "project",
      organizationId: "organization",
      userId: "user_1",
      source: "site_audit",
      runId: "audit-1",
      runKind: "audit",
      provider: "dataforseo",
      creditFeature: "backlinks",
      apiPath: "v3/backlinks/summary/live",
      operation: "Probe",
      requestSummary: '{"target":"example.com"}',
      resultCount: 3,
      costUsd: 0.02,
      status: "ok",
    });
  });

  it("derives the source from the credit feature without a ctx", async () => {
    vi.mocked(fetchBacklinksSummary).mockResolvedValue({
      data: { rank: 1 },
      billing: { costUsd: 0.02, path },
    });
    await createDataforseoClient(customer).backlinks.summary({
      target: "example.com",
    });
    const [row] = await listAll();
    expect(row).toMatchObject({
      source: "backlinks",
      operation: "v3/backlinks/summary/live",
      runId: null,
    });
  });

  it("records a charged failure as failed_charged and still throws", async () => {
    vi.mocked(fetchBacklinksSummary).mockRejectedValue(
      new DataforseoChargedTaskError("boom", { costUsd: 0.02, path }),
    );
    await expect(
      createDataforseoClient(customer).backlinks.summary({
        target: "example.com",
      }),
    ).rejects.toThrow("boom");
    const [row] = await listAll();
    expect(row).toMatchObject({ status: "failed_charged", costUsd: 0.02 });
  });

  it("writes nothing for an uncharged failure or a missing project", async () => {
    vi.mocked(fetchBacklinksSummary).mockRejectedValue(new Error("network"));
    await expect(
      createDataforseoClient(customer).backlinks.summary({ target: "a.com" }),
    ).rejects.toThrow("network");
    vi.mocked(fetchBacklinksSummary).mockResolvedValue({
      data: { rank: 1 },
      billing: { costUsd: 0.02, path },
    });
    await createDataforseoClient({
      ...customer,
      projectId: undefined,
    }).backlinks.summary({ target: "a.com" });
    expect(await listAll()).toHaveLength(0);
  });

  it("does not fail the metered call when the ledger write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    state.failWrites = true;
    vi.mocked(fetchBacklinksSummary).mockResolvedValue({
      data: { rank: 7 },
      billing: { costUsd: 0.02, path },
    });
    await expect(
      createDataforseoClient(customer).backlinks.summary({
        target: "example.com",
      }),
    ).resolves.toEqual({ rank: 7 });
    expect(error).toHaveBeenCalledWith(
      "[cost-ledger] write failed",
      expect.anything(),
    );
    error.mockRestore();
  });
});
