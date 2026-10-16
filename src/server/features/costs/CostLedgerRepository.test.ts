import { beforeEach, describe, expect, it, vi } from "vitest";
import { CostLedgerRepository as repo } from "./CostLedgerRepository";

const { testDb, state } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } =
    await import("@/server/features/metrics-history/metricsHistoryTestDb");
  return {
    testDb: await createMetricsHistoryTestDb(),
    state: { failWrites: false },
  };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({
  runBatch: (...args: Parameters<typeof testDb.runBatch>) => {
    if (state.failWrites) throw new Error("db down");
    return testDb.runBatch(...args);
  },
}));

const P = "project";
const entry = (
  occurredAt: string,
  costUsd: number,
  extra: Partial<Parameters<typeof repo.record>[0]> = {},
) => ({
  projectId: P,
  organizationId: "organization",
  occurredAt,
  source: "serp" as const,
  provider: "dataforseo" as const,
  operation: "SERP analysis: boat",
  costUsd,
  status: "ok" as const,
  ...extra,
});

beforeEach(async () => {
  state.failWrites = false;
  await testDb.seedProject();
});

describe("CostLedgerRepository", () => {
  it("records and lists rows newest first inside the window", async () => {
    await repo.record(entry("2026-10-01T10:00:00.000Z", 0.01));
    await repo.record(
      entry("2026-10-02T10:00:00.000Z", 0.02, { resultCount: 7 }),
    );
    await repo.record(entry("2026-09-01T10:00:00.000Z", 0.5));
    const rows = await repo.listByProject(P, {
      from: "2026-10-01",
      to: "2026-10-02",
    });
    expect(rows.map((r) => r.costUsd)).toEqual([0.02, 0.01]);
    expect(rows[0]).toMatchObject({
      resultCount: 7,
      runId: null,
      userId: null,
    });
  });

  it("chunks recordMany under the parameter limit", async () => {
    await repo.recordMany(
      Array.from({ length: 23 }, (_, i) =>
        entry("2026-10-03T00:00:00.000Z", 0.001 * (i + 1)),
      ),
    );
    const rows = await repo.listByProject(P, {
      from: "2026-10-03",
      to: "2026-10-03",
    });
    expect(rows).toHaveLength(23);
  });

  it("sums by run and by day", async () => {
    await repo.recordMany([
      entry("2026-10-01T01:00:00.000Z", 0.25, {
        runId: "run-a",
        runKind: "rank_check_run",
        source: "rank_check",
      }),
      entry("2026-10-01T02:00:00.000Z", 0.25, {
        runId: "run-a",
        runKind: "rank_check_run",
        source: "rank_check",
        status: "failed_charged",
      }),
      entry("2026-10-02T02:00:00.000Z", 1, { runId: "run-b" }),
      entry("2026-10-02T03:00:00.000Z", 2, { source: "domain" }),
    ]);
    const sums = await repo.sumByRun(["run-a", "run-b", "run-none"]);
    expect(sums.get("run-a")).toEqual({ costUsd: 0.5, rows: 2 });
    expect(sums.get("run-b")).toEqual({ costUsd: 1, rows: 1 });
    expect(sums.has("run-none")).toBe(false);

    const days = await repo.sumByDay(P, "2026-10-01", "2026-10-02");
    expect(days).toEqual([
      { date: "2026-10-01", source: "rank_check", usd: 0.5 },
      { date: "2026-10-02", source: "domain", usd: 2 },
      { date: "2026-10-02", source: "serp", usd: 1 },
    ]);
    expect(await repo.earliestAt(P)).toBe("2026-10-01T01:00:00.000Z");
  });

  it("truncates a long request summary to 500 characters", async () => {
    await repo.record(
      entry("2026-10-04T00:00:00.000Z", 1, { requestSummary: "x".repeat(900) }),
    );
    const [row] = await repo.listByProject(P, {
      from: "2026-10-04",
      to: "2026-10-04",
    });
    expect(row?.requestSummary).toHaveLength(500);
  });

  it("never throws when the write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    state.failWrites = true;
    await expect(
      repo.record(entry("2026-10-05T00:00:00.000Z", 1)),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[cost-ledger] write failed",
      expect.anything(),
    );
    error.mockRestore();
  });
});
