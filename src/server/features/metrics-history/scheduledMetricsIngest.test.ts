import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetricsHistoryRepository as repo } from "./MetricsHistoryRepository";

const { testDb } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } = await import("./metricsHistoryTestDb");
  return { testDb: await createMetricsHistoryTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));
vi.mock("./GscIngestService", () => ({ ingestGscWindow: vi.fn() }));
vi.mock("./Ga4IngestService", () => ({
  ingestGa4Window: vi.fn(),
  findGa4PropertyStart: vi.fn(),
}));

const { ingestGscWindow } = await import("./GscIngestService");
const { ingestGa4Window, findGa4PropertyStart } =
  await import("./Ga4IngestService");
const { runScheduledMetricsIngest } = await import("./scheduledMetricsIngest");

const P = "project";
const NOW = new Date("2026-10-16T12:00:00.000Z");
const gscMock = vi.mocked(ingestGscWindow);
const ga4Mock = vi.mocked(ingestGa4Window);

async function connect(which: "gsc" | "ga4" | "both") {
  if (which !== "ga4")
    await testDb.client.execute(
      `INSERT INTO gsc_connections (id, project_id, organization_id, site_url, connected_by_user_id)
       VALUES ('g1', '${P}', 'organization', 'sc-domain:openseo.so', 'u1')`,
    );
  if (which !== "gsc")
    await testDb.client.execute(
      `INSERT INTO ga4_connections (id, project_id, organization_id, property_id, property_display_name,
         property_time_zone, property_currency_code, connected_by_user_id, ga4_account_id)
       VALUES ('a1', '${P}', 'organization', 'properties/1', 'P', 'UTC', 'USD', 'u1', 'acc')`,
    );
}

const laterThan = (ms: number) => new Date(NOW.getTime() + ms);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  gscMock.mockResolvedValue({
    fetched: { site: 0, page: 0, queryPage: 0 },
    requests: 4,
  });
  ga4Mock.mockResolvedValue({
    fetched: { total: 0, channel: 0, landingPage: 0, keyEvent: 0 },
    requests: 4,
  });
  vi.mocked(findGa4PropertyStart).mockResolvedValue("2026-08-01");
  await testDb.seedProject();
});

describe("runScheduledMetricsIngest", () => {
  it("claims a fresh project and walks the whole backfill in one tick", async () => {
    await connect("gsc");
    const summary = await runScheduledMetricsIngest(NOW);
    // 485 days at 31 days per window, newest first, ending today-3.
    expect(gscMock).toHaveBeenCalledTimes(16);
    expect(gscMock.mock.calls[0]?.slice(1)).toEqual([
      "2026-09-13",
      "2026-10-13",
      { today: "2026-10-16" },
    ]);
    expect(gscMock.mock.calls.at(-1)?.[1]).toBe("2025-06-18");
    const state = await repo.getState(P, "gsc");
    expect(state).toMatchObject({
      backfillCursorDate: "2025-06-17",
      backfillDone: true,
      lastError: null,
      claimedAt: null,
    });
    expect(summary).toMatchObject({ claimed: 1, backfilled: 1 });
  });

  it("stops walking at the per-item budget and resumes from the cursor next tick", async () => {
    await connect("gsc");
    const realNow = Date.now;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(realNow);
    try {
      // After the first window, pretend seven minutes passed (budget is six).
      gscMock.mockImplementationOnce(async () => {
        nowSpy.mockImplementation(() => realNow() + 7 * 60_000);
        return { fetched: { site: 0, page: 0, queryPage: 0 }, requests: 0 };
      });
      await runScheduledMetricsIngest(NOW);
      expect(gscMock).toHaveBeenCalledTimes(1);
      let state = await repo.getState(P, "gsc");
      expect(state).toMatchObject({
        backfillCursorDate: "2026-09-12",
        backfillDone: false,
        claimedAt: null,
      });
      nowSpy.mockImplementation(realNow);
      await runScheduledMetricsIngest(NOW);
      expect(gscMock.mock.calls[1]?.slice(1, 3)).toEqual([
        "2026-08-13",
        "2026-09-12",
      ]);
      state = await repo.getState(P, "gsc");
      expect(state?.backfillDone).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("uses the GA4 property start as the floor", async () => {
    await connect("ga4");
    await runScheduledMetricsIngest(NOW);
    await runScheduledMetricsIngest(NOW);
    expect(ga4Mock.mock.calls[1]?.slice(1)).toEqual([
      "2026-08-15",
      "2026-09-14",
    ]);
    expect(findGa4PropertyStart).toHaveBeenCalled();
  });

  it("does not ingest when done and recently successful", async () => {
    await connect("gsc");
    await repo.ensureState(P, "gsc");
    await repo.release(P, "gsc", {
      backfillDone: true,
      lastSuccessAt: laterThan(-60_000).toISOString(),
    });
    const summary = await runScheduledMetricsIngest(NOW);
    expect(gscMock).not.toHaveBeenCalled();
    expect(summary.upToDate).toBe(1);
    expect((await repo.getState(P, "gsc"))?.claimedAt).toBeNull();
  });

  it("refreshes the trailing window when lastSuccessAt is stale", async () => {
    await connect("both");
    await repo.ensureState(P, "gsc");
    await repo.ensureState(P, "ga4");
    const stale = laterThan(-21 * 3_600_000).toISOString();
    for (const source of ["gsc", "ga4"] as const)
      await repo.release(P, source, {
        backfillDone: true,
        lastSuccessAt: stale,
      });
    await runScheduledMetricsIngest(NOW);
    expect(gscMock.mock.calls[0]?.slice(1, 3)).toEqual([
      "2026-10-08",
      "2026-10-13",
    ]);
    expect(ga4Mock.mock.calls[0]?.slice(1)).toEqual([
      "2026-10-12",
      "2026-10-15",
    ]);
    expect((await repo.getState(P, "gsc"))?.lastSuccessAt).toBe(
      NOW.toISOString(),
    );
  });

  it("stores a sanitized error, releases the claim and continues", async () => {
    await connect("both");
    gscMock.mockRejectedValueOnce(
      new TypeError(`boom Bearer ya29.abc-123 ${"x".repeat(600)}`),
    );
    const summary = await runScheduledMetricsIngest(NOW);
    const state = await repo.getState(P, "gsc");
    expect(state?.claimedAt).toBeNull();
    expect(state?.lastError).toMatch(/^TypeError: boom/);
    expect(state?.lastError).not.toMatch(/ya29|Bearer ya29/);
    expect(state?.lastError?.length).toBeLessThanOrEqual(500);
    // GA4 still walked its three windows back to the 2026-08-01 floor.
    expect(ga4Mock).toHaveBeenCalledTimes(3);
    expect(summary.failed).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("skips a row claimed within the last 20 minutes", async () => {
    await connect("gsc");
    await repo.ensureState(P, "gsc");
    await repo.claim(
      P,
      "gsc",
      laterThan(-5 * 60_000).toISOString(),
      "2000-01-01T00:00:00.000Z",
    );
    const summary = await runScheduledMetricsIngest(NOW);
    expect(gscMock).not.toHaveBeenCalled();
    expect(summary.alreadyClaimed).toBe(1);
  });
});
