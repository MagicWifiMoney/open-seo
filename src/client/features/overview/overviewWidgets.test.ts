import { describe, expect, it } from "vitest";
import { buildKpi } from "./overviewMetrics";
import {
  buildStatTiles,
  deltaChip,
  gaSeries,
  sparklinePoints,
} from "./overviewWidgets";

describe("deltaChip", () => {
  it("shows a percent for a count and treats a falling position as good", () => {
    expect(
      deltaChip(buildKpi({ key: "clicks", current: 150, base: 100 })),
    ).toEqual({ arrow: "up", text: "50.0%", tone: "good" });
    expect(
      deltaChip(buildKpi({ key: "position", current: 7, base: 9 })),
    ).toEqual({ arrow: "down", text: "2.0 places", tone: "good" });
  });

  it("shows a plain change from a small base and nothing without a base", () => {
    expect(deltaChip(buildKpi({ key: "clicks", current: 4, base: 1 }))).toEqual(
      { arrow: "up", text: "3 more", tone: "good" },
    );
    expect(
      deltaChip(buildKpi({ key: "clicks", current: 4, base: null })),
    ).toBeNull();
  });
});

describe("gaSeries", () => {
  const days = Array.from({ length: 70 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    sessions: 1,
    users: 1,
    keyEvents: 0,
  }));
  const cover = { start: "2026-09-01", end: "2026-12-31" };
  it("returns null for a window with too few days", () => {
    const span = { start: "2026-09-01", end: "2026-09-02" };
    expect(gaSeries(days, span, "sessions", cover)).toBeNull();
  });
  it("sums runs of days so no more than 30 points are drawn", () => {
    const all = days.map((d, i) => ({
      ...d,
      date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    }));
    const series = gaSeries(
      all,
      { start: all[0].date, end: all[69].date },
      "sessions",
      { start: all[0].date, end: all[69].date },
    );
    expect(series).toHaveLength(24);
    expect(series?.reduce((a, b) => a + b, 0)).toBe(70);
  });
});

describe("sparklinePoints", () => {
  it("puts the high value at the top and handles a flat series", () => {
    expect(sparklinePoints([0, 10], 10, 10, 0)).toBe("0.0,10.0 10.0,0.0");
    expect(sparklinePoints([5, 5, 5], 10, 10, 0)).toBe(
      "0.0,5.0 5.0,5.0 10.0,5.0",
    );
  });
});

describe("buildStatTiles", () => {
  const input = {
    currentLabel: "Sep 15, 2026 to Oct 12, 2026",
    compareLabel: "Aug 18, 2026 to Sep 14, 2026",
    kpis: {
      clicks: buildKpi({ key: "clicks", current: 120, base: 100 }),
      position: buildKpi({ key: "position", current: 7, base: 8.5 }),
    },
    rankings: {
      device: "desktop",
      total: 109,
      checked: 80,
      latestLabel: "Oct 10, 2026",
      topTenNow: 24,
      topTenBefore: null,
      previousLabel: null,
    },
    newPages: {
      count: 49,
      lookbackLabel: "May 1, 2026 to Aug 14, 2026",
      maybeIncomplete: true,
    },
  };

  it("keeps coverage and caveats on the tile that had them", () => {
    const tiles = buildStatTiles(input);
    expect(tiles.map((t) => t.key)).toEqual([
      "topTen",
      "newPages",
      "clicks",
      "position",
    ]);
    expect(tiles[0].value).toBe("24");
    expect(tiles[0].context).toContain("checked 80 of 109 keywords");
    expect(tiles[0].context).toContain("may undercount");
    expect(tiles[1].context).toContain("may be low");
    expect(tiles[2].value).toBe("+20.0%");
    expect(tiles[3].value).toBe("1.5");
    expect(tiles[3].label).toBe("Places closer to top");
  });

  it("omits tiles whose source is missing", () => {
    expect(
      buildStatTiles({ ...input, kpis: {}, rankings: null, newPages: null }),
    ).toEqual([]);
  });
});
