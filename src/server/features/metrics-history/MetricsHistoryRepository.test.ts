import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMON_PARAMS,
  CONFLICT_PARAMS,
  D1_PARAM_LIMIT,
  MetricsHistoryRepository as repo,
  rowsPerStatement,
} from "./MetricsHistoryRepository";

const { testDb } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } = await import("./metricsHistoryTestDb");
  return { testDb: await createMetricsHistoryTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const P = "project";
const site = (date: string, clicks: number, finalized = false) => ({
  date,
  device: "",
  clicks,
  impressions: clicks * 10,
  ctr: 0.1,
  position: 3.5,
  finalized,
});
const total = (date: string, sessions: number) => ({
  date,
  sessions,
  activeUsers: sessions,
  engagedSessions: sessions,
  keyEvents: 1,
});

beforeEach(async () => {
  await testDb.seedProject();
});

describe("upserts", () => {
  it("are idempotent and update metrics", async () => {
    await repo.upsertGa4Total(P, [total("2026-01-01", 5)]);
    await repo.upsertGa4Total(P, [total("2026-01-01", 9)]);
    const rows = await repo.getGa4Total(P, "2026-01-01", "2026-01-31");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sessions).toBe(9);
  });

  it("chunks large inputs under the parameter limit", async () => {
    const rows = Array.from({ length: 95 }, (_, i) =>
      site(`2026-02-${String(i).padStart(3, "0")}`, i),
    );
    await repo.upsertGscSite(P, rows);
    await repo.upsertGscSite(P, rows);
    const out = await repo.getGscSite(P, "2026-02-000", "2026-02-999");
    expect(out).toHaveLength(95);
  });

  it("does not let a non-finalized GSC row overwrite a finalized one", async () => {
    await repo.upsertGscSite(P, [site("2026-01-01", 10, true)]);
    await repo.upsertGscSite(P, [site("2026-01-01", 99, false)]);
    let [row] = await repo.getGscSite(P, "2026-01-01", "2026-01-01");
    expect(row).toMatchObject({ clicks: 10, finalized: true });
    await repo.upsertGscSite(P, [site("2026-01-01", 20, true)]);
    [row] = await repo.getGscSite(P, "2026-01-01", "2026-01-01");
    expect(row).toMatchObject({ clicks: 20, finalized: true });
  });

  it("lets a non-finalized row be replaced by a later fetch", async () => {
    await repo.upsertGscPage(P, [{ ...site("2026-01-01", 1), page: "/a" }]);
    await repo.upsertGscPage(P, [{ ...site("2026-01-01", 4), page: "/a" }]);
    const rows = await repo.getGscPage(P, "2026-01-01", "2026-01-01", 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.clicks).toBe(4);
  });
});

describe("ingest state", () => {
  it("claims once, blocks while held, and reclaims after the stale cutoff", async () => {
    await repo.ensureState(P, "gsc");
    await repo.ensureState(P, "gsc");
    const t1 = "2026-01-01T00:00:00.000Z";
    expect(await repo.claim(P, "gsc", t1, "2025-12-31T23:00:00.000Z")).toBe(
      true,
    );
    expect(await repo.claim(P, "gsc", t1, "2025-12-31T23:00:00.000Z")).toBe(
      false,
    );
    expect(
      await repo.claim(
        P,
        "gsc",
        "2026-01-01T02:00:00.000Z",
        "2026-01-01T01:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("returns false when no state row exists", async () => {
    expect(await repo.claim(P, "ga4", "2026-01-01", "2025-01-01")).toBe(false);
  });

  it("release clears the claim and stores the error", async () => {
    await repo.ensureState(P, "ga4");
    await repo.claim(P, "ga4", "2026-01-01T00:00:00.000Z", "2025-01-01");
    await repo.release(P, "ga4", { lastError: "boom" });
    const state = await repo.getState(P, "ga4");
    expect(state).toMatchObject({ claimedAt: null, lastError: "boom" });
    await repo.release(P, "ga4", {
      backfillDone: true,
      backfillCursorDate: "2026-01-01",
      lastError: null,
    });
    expect(await repo.getState(P, "ga4")).toMatchObject({
      backfillDone: true,
      lastError: null,
    });
  });
});

describe("coverage", () => {
  it("reports min, max, finalized max and row counts", async () => {
    await repo.upsertGscSite(P, [
      site("2026-01-01", 1, true),
      site("2026-01-02", 1, true),
      site("2026-01-03", 1, false),
    ]);
    await repo.upsertGa4Total(P, [
      total("2026-01-05", 1),
      total("2026-01-09", 1),
    ]);
    const c = await repo.coverage(P);
    expect(c.gsc).toEqual({
      minDate: "2026-01-01",
      maxDate: "2026-01-03",
      maxFinalizedDate: "2026-01-02",
    });
    expect(c.ga4).toEqual({ minDate: "2026-01-05", maxDate: "2026-01-09" });
    expect(c.rowCounts.gscDailySite).toBe(3);
    expect(c.rowCounts.ga4DailyTotal).toBe(2);
  });
});

const qp = (
  date: string,
  query: string,
  extra: {
    device: string;
    clicks: number;
    impressions: number;
    position: number;
    finalized?: boolean;
  },
) => ({ date, query, page: "/1", ctr: 0, finalized: true, ...extra });

describe("query totals and coverage ends", () => {
  it("sums per query across pages, devices and dates with weighted position", async () => {
    await repo.upsertGscQueryPage(P, [
      {
        ...qp("2026-01-01", "a", {
          device: "MOBILE",
          clicks: 2,
          impressions: 10,
          position: 2,
        }),
        page: "/1",
      },
      {
        ...qp("2026-01-01", "a", {
          device: "DESKTOP",
          clicks: 3,
          impressions: 30,
          position: 6,
        }),
        page: "/2",
      },
      {
        ...qp("2026-01-02", "a", {
          device: "MOBILE",
          clicks: 1,
          impressions: 10,
          position: 4,
        }),
        page: "/1",
      },
      {
        ...qp("2026-01-02", "b", {
          device: "MOBILE",
          clicks: 9,
          impressions: 20,
          position: 1,
        }),
        page: "/1",
      },
      {
        ...qp("2026-01-02", "zero", {
          device: "MOBILE",
          clicks: 0,
          impressions: 0,
          position: 0,
        }),
        page: "/1",
      },
      {
        ...qp("2026-01-09", "out", {
          device: "MOBILE",
          clicks: 5,
          impressions: 5,
          position: 1,
        }),
        page: "/1",
      },
    ]);
    const rows = await repo.getGscQueryTotals(P, "2026-01-01", "2026-01-02", {
      finalizedOnly: true,
    });
    expect(rows.map((r) => r.query)).toEqual(["b", "a"]);
    expect(rows[0]).toEqual({
      query: "b",
      clicks: 9,
      impressions: 20,
      position: 1,
    });
    // (2*10 + 6*30 + 4*10) / 50 = 4.8
    expect(rows[1]).toMatchObject({ clicks: 6, impressions: 50 });
    expect(rows[1]?.position).toBeCloseTo(4.8);
  });

  it("finalizedOnly excludes non-finalized rows", async () => {
    await repo.upsertGscQueryPage(P, [
      {
        ...qp("2026-01-01", "a", {
          device: "MOBILE",
          clicks: 2,
          impressions: 10,
          position: 2,
        }),
        page: "/1",
      },
      {
        ...qp("2026-01-02", "a", {
          device: "MOBILE",
          clicks: 8,
          impressions: 10,
          position: 4,
          finalized: false,
        }),
        page: "/1",
      },
    ]);
    const window = ["2026-01-01", "2026-01-02"] as const;
    const final = await repo.getGscQueryTotals(P, ...window, {
      finalizedOnly: true,
    });
    expect(final[0]).toMatchObject({ clicks: 2, impressions: 10 });
    const all = await repo.getGscQueryTotals(P, ...window, {
      finalizedOnly: false,
    });
    expect(all[0]).toMatchObject({ clicks: 10, impressions: 20 });
  });

  it("reports finalized-through and GA4 end, or null when empty", async () => {
    expect(await repo.getGscFinalizedThrough(P)).toBeNull();
    expect(await repo.getGa4CoverageEnd(P)).toBeNull();
    await repo.upsertGscSite(P, [
      site("2026-01-01", 1, true),
      site("2026-01-02", 1, true),
      site("2026-01-03", 1, false),
    ]);
    await repo.upsertGa4Total(P, [
      total("2026-01-05", 1),
      total("2026-01-09", 1),
    ]);
    expect(await repo.getGscFinalizedThrough(P)).toBe("2026-01-02");
    expect(await repo.getGa4CoverageEnd(P)).toBe("2026-01-09");
  });
});

describe("rowsPerStatement", () => {
  it("keeps every table's statement under D1's bound-parameter limit", () => {
    // own columns per table: GSC site 6, page 5, query/page 7; GA4 total 4,
    // channel 5, landing page 5, key event 4.
    for (const own of [6, 5, 7, 4, 5, 5, 4]) {
      const perRow = COMMON_PARAMS + own;
      const bound = rowsPerStatement(own) * perRow + CONFLICT_PARAMS;
      expect(rowsPerStatement(own)).toBeGreaterThan(0);
      expect(bound).toBeLessThan(D1_PARAM_LIMIT);
    }
  });
});
