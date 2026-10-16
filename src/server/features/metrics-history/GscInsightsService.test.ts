import { sort } from "remeda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetricsHistoryRepository as repo } from "./MetricsHistoryRepository";
import { GscInsightsService as svc } from "./GscInsightsService";
import {
  addDays,
  resolveCompareWindow,
  resolveWindow,
} from "./gscInsightsWindows";

const { testDb } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } = await import("./metricsHistoryTestDb");
  return { testDb: await createMetricsHistoryTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const P = "project";
const START = "2026-01-01";
// 60 days: 2026-01-01 .. 2026-03-01. Current 28d = Feb 2..Mar 1, prior = Jan 5..Feb 1.
const END = addDays(START, 59);
const dates = Array.from({ length: 60 }, (_, i) => addDays(START, i));
const isCurrent = (date: string) => date >= "2026-02-02";

const m = (
  clicks: number,
  impressions: number,
  position: number,
  date: string,
) => ({
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
  finalized: date <= "2026-02-25",
});

async function seed() {
  // Site: all-device row = desktop + mobile. Prior days 10/100 clicks/impr, current 20/200.
  await repo.upsertGscSite(
    P,
    dates.flatMap((date) => {
      const k = isCurrent(date) ? 2 : 1;
      return [
        { date, device: "", ...m(10 * k, 100 * k, 4, date) },
        { date, device: "DESKTOP", ...m(4 * k, 40 * k, 4, date) },
        { date, device: "MOBILE", ...m(6 * k, 60 * k, 4, date) },
      ];
    }),
  );
  await repo.upsertGscPage(
    P,
    dates.flatMap((date) => [
      {
        date,
        page: "https://x.test/a",
        ...m(isCurrent(date) ? 15 : 5, 100, 3, date),
      },
      { date, page: "https://x.test/b", ...m(5, 100, 8, date) },
    ]),
  );
  await repo.upsertGscQueryPage(
    P,
    dates.flatMap((date) => {
      const cur = isCurrent(date);
      return [
        // rising: 1 click/day prior, 3 now, ranks 2 (top3)
        {
          date,
          query: "rising",
          page: "https://x.test/a",
          device: "DESKTOP",
          ...m(cur ? 3 : 1, 10, 2, date),
        },
        // falling: 3 prior, 1 now, ranks 8 (top10) on mobile
        {
          date,
          query: "falling",
          page: "https://x.test/b",
          device: "MOBILE",
          ...m(cur ? 1 : 3, 10, 8, date),
        },
        // steady deep result, position 15 (top20) on mobile
        {
          date,
          query: "steady",
          page: "https://x.test/b",
          device: "MOBILE",
          ...m(2, 10, 15, date),
        },
        // far-down: 30 (beyond), below the 5 impression floor each day? 1/day, 28 days = 28 impr
        {
          date,
          query: "deep",
          page: "https://x.test/b",
          device: "DESKTOP",
          ...m(0, 1, 30, date),
        },
        // new query only in current window, 0 prior
        ...(cur
          ? [
              {
                date,
                query: "brand new",
                page: "https://x.test/a",
                device: "DESKTOP",
                ...m(1, 5, 5, date),
              },
            ]
          : []),
      ];
    }),
  );
}

beforeEach(async () => {
  await testDb.seedProject();
});

describe("window math", () => {
  it("ends at coverage and builds previous and yoy windows", () => {
    const cov = { start: START, end: END };
    const w = resolveWindow({ range: "28d" }, cov);
    expect(w).toEqual({ start: "2026-02-02", end: END });
    expect(resolveCompareWindow(w, "previous_period")).toEqual({
      start: "2026-01-05",
      end: "2026-02-01",
    });
    expect(resolveCompareWindow(w, "year_over_year")).toEqual({
      start: "2025-02-02",
      end: "2025-03-01",
    });
    expect(resolveCompareWindow(w, "none")).toBeNull();
    expect(
      resolveWindow(
        { range: "16m", from: "2026-01-10", to: "2027-01-01" },
        cov,
      ),
    ).toEqual({
      start: "2026-01-10",
      end: END,
    });
  });
});

describe("getInsights", () => {
  it("returns null coverage when nothing is stored", async () => {
    const out = await svc.getInsights({
      projectId: P,
      range: "28d",
      compare: "previous_period",
      device: "all",
    });
    expect(out).toEqual({ coverage: null });
  });

  it("computes totals, deltas, coverage and the daily series", async () => {
    await seed();
    const out = await svc.getInsights({
      projectId: P,
      range: "28d",
      compare: "previous_period",
      device: "all",
    });
    if (out.coverage === null) throw new Error("expected coverage");
    expect(out.coverage).toEqual({
      start: START,
      end: END,
      finalizedThrough: "2026-02-25",
    });
    expect(out.source).toBe("stored");
    expect(out.daily).toHaveLength(28);
    expect(out.compareDaily).toHaveLength(28);
    expect(out.totals).toMatchObject({
      clicks: 20 * 28,
      impressions: 200 * 28,
    });
    expect(out.totals.ctr).toBeCloseTo(0.1);
    expect(out.totals.position).toBeCloseTo(4);
    expect(out.compareTotals).toMatchObject({
      clicks: 10 * 28,
      impressions: 100 * 28,
    });
    expect(out.deltas?.clicks).toEqual({ absolute: 280, percent: 100 });
    expect(out.deltas?.position.absolute).toBeCloseTo(0);
    expect(out.deviceSplit.map((d) => d.device)).toEqual(["mobile", "desktop"]);
    expect(out.deviceSplit[0]?.clicksShare).toBeCloseTo(0.6);
  });

  it("filters by device and drops compare when none", async () => {
    await seed();
    const out = await svc.getInsights({
      projectId: P,
      range: "28d",
      compare: "none",
      device: "desktop",
    });
    if (out.coverage === null) throw new Error("expected coverage");
    expect(out.totals.clicks).toBe(8 * 28);
    expect(out.compareTotals).toBeNull();
    expect(out.deltas).toBeNull();
    expect(out.compareDaily).toEqual([]);
    expect(out.movers).toEqual({ gainers: [], losers: [] });
    // desktop query rows only: rising + deep + brand new
    expect(
      sort(
        out.topQueries.map((q) => q.key),
        (a, b) => a.localeCompare(b),
      ),
    ).toEqual(["brand new", "deep", "rising"]);
  });

  it("buckets impressions by position", async () => {
    await seed();
    const out = await svc.getInsights({
      projectId: P,
      range: "28d",
      compare: "none",
      device: "all",
    });
    if (out.coverage === null) throw new Error("expected coverage");
    // per current day: top3 10 (rising), top10 10 (falling) + 5 (brand new, pos 5), top20 10, beyond 1
    expect(out.positionBuckets).toMatchObject({
      top3: 280,
      top10: 28 * 15,
      top20: 280,
      beyond: 28,
      total: 280 + 420 + 280 + 28,
    });
    expect(out.positionBuckets.shares.top3).toBeCloseTo(280 / 1008);
  });

  it("ranks top queries and pages with prior values", async () => {
    await seed();
    const out = await svc.getInsights({
      projectId: P,
      range: "28d",
      compare: "previous_period",
      device: "all",
    });
    if (out.coverage === null) throw new Error("expected coverage");
    expect(out.topQueries[0]).toMatchObject({
      key: "rising",
      clicks: 84,
      prevClicks: 28,
      clicksDelta: 56,
      positionDelta: 0,
    });
    const fresh = out.topQueries.find((q) => q.key === "brand new");
    expect(fresh).toMatchObject({ prevImpressions: 0, positionDelta: null });
    expect(out.topPages[0]).toMatchObject({
      key: "https://x.test/a",
      clicks: 15 * 28,
      prevClicks: 5 * 28,
    });
  });

  it("finds movers with the impression floor", async () => {
    await seed();
    const out = await svc.getInsights({
      projectId: P,
      range: "28d",
      compare: "previous_period",
      device: "all",
    });
    if (out.coverage === null) throw new Error("expected coverage");
    expect(out.movers.gainers.map((r) => r.key)).toEqual([
      "rising",
      "brand new",
    ]);
    expect(out.movers.gainers[0]).toMatchObject({
      clicksDelta: 56,
      position: 2,
    });
    expect(out.movers.losers.map((r) => r.key)).toEqual(["falling"]);
    expect(out.movers.losers[0]?.clicksDelta).toBe(-56);
  });
});
