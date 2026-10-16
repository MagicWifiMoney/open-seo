import { describe, expect, it } from "vitest";
import { launchComparison } from "@/client/features/overview/overviewRange";
import {
  buildMovers,
  buildStrikingDistanceRows,
  previousPeriod,
  resolveSearchWindows,
  scaleTotals,
  sumSearchTotals,
} from "@/server/features/gsc/searchPerformanceReport";

describe("sumSearchTotals", () => {
  it("sums clicks/impressions and impression-weights position", () => {
    const totals = sumSearchTotals([
      { clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
      { clicks: 5, impressions: 300, ctr: 0.016, position: 10 },
    ]);
    expect(totals.clicks).toBe(15);
    expect(totals.impressions).toBe(400);
    expect(totals.ctr).toBeCloseTo(15 / 400);
    // (2*100 + 10*300) / 400 = 8
    expect(totals.position).toBeCloseTo(8);
  });

  it("returns zeros for no rows instead of NaN", () => {
    expect(sumSearchTotals([])).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });
});

const row = (query: string, position: number, impressions: number) => ({
  keys: [query, `https://example.com/${query}`],
  clicks: 1,
  impressions,
  ctr: 0.01,
  position,
});

// Same query can map to multiple pages; this lets a test set distinct pages.
const pageRow = (
  query: string,
  page: string,
  position: number,
  impressions: number,
) => ({ keys: [query, page], clicks: 1, impressions, ctr: 0.01, position });

describe("buildStrikingDistanceRows", () => {
  it("keeps positions 5..20 inclusive and sorts by impressions desc", () => {
    const rows = buildStrikingDistanceRows([
      row("top-spot", 2, 900),
      row("low-edge", 5, 10),
      row("close", 6.4, 100),
      row("closer", 11, 400),
      row("high-edge", 20, 20),
      row("page-3", 24, 800),
    ]);
    expect(rows.map((r) => r.query)).toEqual([
      "closer",
      "close",
      "high-edge",
      "low-edge",
    ]);
  });

  it("drops a query whose top page already ranks above the band", () => {
    // openseo: homepage ranks #2, a secondary page ranks #6. The site already
    // ranks near the top, so the query is not a striking-distance opportunity.
    const rows = buildStrikingDistanceRows([
      pageRow("openseo", "https://x.com/home", 2, 900),
      pageRow("openseo", "https://x.com/mcp", 6, 300),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("collapses a query to its best-ranking page when that page is in band", () => {
    const rows = buildStrikingDistanceRows([
      pageRow("kw", "https://x.com/a", 14, 100),
      pageRow("kw", "https://x.com/b", 8, 500),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].page).toBe("https://x.com/b");
    expect(rows[0].position).toBe(8);
  });
});

describe("previousPeriod", () => {
  it.each([
    ["2026-06-01", "2026-06-28", "2026-05-04", "2026-05-31"],
    ["2026-06-10", "2026-06-10", "2026-06-09", "2026-06-09"],
  ])(
    "returns the same-length window ending the day before %s..%s",
    (startDate, endDate, prevStart, prevEnd) => {
      expect(previousPeriod(startDate, endDate)).toEqual({
        startDate: prevStart,
        endDate: prevEnd,
      });
    },
  );
});

describe("resolveSearchWindows", () => {
  const today = new Date("2026-10-16T12:00:00Z");

  it("since launch runs launch to latest data day against the 12 weeks before launch", () => {
    const windows = resolveSearchWindows("since_launch", today, "2026-08-15");
    expect(windows).toMatchObject({
      startDate: "2026-08-15",
      endDate: "2026-10-13",
      prevStartDate: "2026-05-23",
      prevEndDate: "2026-08-14",
      baseline: "launch",
    });
    // 60 days now against 84 days before launch.
    expect(windows.scale).toBeCloseTo(60 / 84);
  });

  it("matches the Overview's launch comparison dates", () => {
    const pair = launchComparison("2026-08-15", "2026-10-13");
    const windows = resolveSearchWindows("since_launch", today, "2026-08-15");
    expect(pair).not.toBeNull();
    expect(windows.prevStartDate).toBe(pair?.reference.start);
    expect(windows.prevEndDate).toBe(pair?.reference.end);
    expect(windows.scale).toBe(pair?.reference.scale);
  });

  it("other ranges compare with the previous period, unscaled", () => {
    const windows = resolveSearchWindows("last_28_days", today, "2026-08-15");
    expect(windows).toMatchObject({
      startDate: "2026-09-15",
      endDate: "2026-10-13",
      prevStartDate: "2026-08-17",
      prevEndDate: "2026-09-14",
      scale: 1,
      baseline: "previous",
    });
  });

  it("falls back to the last 28 days before launch is reached", () => {
    const windows = resolveSearchWindows("since_launch", today, "2026-12-01");
    expect(windows.baseline).toBe("previous");
    expect(windows.endDate).toBe("2026-10-13");
  });
});

describe("scaleTotals", () => {
  it("scales additive totals and leaves ratios alone", () => {
    expect(
      scaleTotals({ clicks: 84, impressions: 840, ctr: 0.1, position: 7 }, 0.5),
    ).toEqual({ clicks: 42, impressions: 420, ctr: 0.1, position: 7 });
  });
});

const moverRow = (query: string, clicks: number, position: number) => ({
  keys: [query],
  clicks,
  impressions: 100,
  ctr: clicks / 100,
  position,
});

describe("buildMovers", () => {
  it("ranks by absolute click change, scales the reference and flags brand", () => {
    const movers = buildMovers(
      [
        moverRow("miller estate sales", 30, 2),
        moverRow("estate sale help", 10, 4),
      ],
      [
        moverRow("miller estate sales", 40, 3),
        moverRow("estate sale help", 4, 9),
        moverRow("old query", 20, 5),
      ],
      0.5,
    );
    expect(movers.map((m) => m.query)).toEqual([
      "miller estate sales",
      "old query",
      "estate sale help",
    ]);
    const brand = movers[0];
    expect(brand).toMatchObject({
      isBrand: true,
      prevClicks: 20,
      clickChange: 10,
      positionChange: 1,
    });
    // Gone from the current window: no position, no position change.
    expect(movers[1]).toMatchObject({
      clicks: 0,
      clickChange: -10,
      position: null,
      positionChange: null,
      isBrand: false,
    });
    expect(movers[2].positionChange).toBe(5);
  });

  it("drops queries that did not move", () => {
    expect(
      buildMovers([moverRow("same", 10, 3)], [moverRow("same", 10, 3)], 1),
    ).toEqual([]);
  });
});
