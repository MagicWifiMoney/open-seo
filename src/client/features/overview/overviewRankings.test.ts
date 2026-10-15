import { describe, expect, it } from "vitest";
import {
  bandOf,
  buildRankingsView,
  defaultTracker,
  type PositionCell,
  type RunCoverage,
} from "./overviewRankings";

const run = (runId: string, over: Partial<RunCoverage> = {}): RunCoverage => ({
  runId,
  checkedAt: `${runId}-date`,
  top3: 0,
  top4to10: 0,
  top11to20: 0,
  notRanking: 0,
  notChecked: 0,
  ...over,
});
const cell = (
  runId: string,
  trackingKeywordId: string,
  position: number | null,
): PositionCell => ({ runId, trackingKeywordId, position });
const names = new Map([
  ["a", "kw a"],
  ["b", "kw b"],
  ["c", "kw c"],
  ["d", "kw d"],
]);

describe("bandOf", () => {
  it("buckets positions and treats null or deep as not ranking", () => {
    expect([1, 3, 4, 10, 11, 20, 21, 40, 41, null].map(bandOf)).toEqual([
      "top3",
      "top3",
      "top10",
      "top10",
      "top20",
      "top20",
      "top40",
      "top40",
      "none",
      "none",
    ]);
  });
});

describe("buildRankingsView", () => {
  it("returns null with no runs", () => {
    expect(buildRankingsView({ runs: [], cells: [], names })).toBeNull();
  });

  it("reports coverage and does not count unchecked keywords as not ranking", () => {
    const view = buildRankingsView({
      runs: [run("r1", { top3: 1, notRanking: 1, notChecked: 2 })],
      cells: [cell("r1", "a", 2), cell("r1", "b", null)],
      names,
    });
    expect(view).toMatchObject({ checked: 2, total: 4, partial: true });
    expect(view?.bands.find((b) => b.key === "none")?.count).toBe(1);
    expect(view?.previous).toBeNull();
  });

  it("compares with the last complete earlier run, skipping a partial one", () => {
    const view = buildRankingsView({
      runs: [
        run("r1", { top3: 1, top4to10: 1, notRanking: 2 }),
        run("r2", { top3: 1, notChecked: 3 }),
        run("r3", { top3: 2, top4to10: 2 }),
      ],
      cells: [
        cell("r1", "a", 5),
        cell("r1", "b", 9),
        cell("r1", "c", null),
        cell("r1", "d", 2),
        cell("r2", "a", 1),
        cell("r3", "a", 2),
        cell("r3", "b", 12),
        cell("r3", "c", 6),
        cell("r3", "d", null),
      ],
      names,
    });
    expect(view?.previous?.runId).toBe("r1");
    expect(view?.gains.map((m) => [m.keyword, m.change])).toEqual([
      ["kw a", 3],
    ]);
    expect(view?.losses.map((m) => [m.keyword, m.change])).toEqual([
      ["kw b", -3],
    ]);
    expect(view?.entered).toEqual(["kw c"]);
    expect(view?.dropped).toEqual(["kw d"]);
    expect(view?.topTenNow).toBe(2);
    expect(view?.topTenBefore).toBe(3);
  });

  it("ignores keywords that are no longer tracked", () => {
    const view = buildRankingsView({
      runs: [run("r1", { top3: 2 })],
      cells: [cell("r1", "a", 1), cell("r1", "gone", 1)],
      names,
    });
    expect(view?.bands[0].count).toBe(1);
  });
});

describe("defaultTracker", () => {
  it("picks the tracker with the most keywords", () => {
    expect(
      defaultTracker([
        { id: "x", keywordCount: 3 },
        { id: "y", keywordCount: 9 },
        { id: "z", keywordCount: 9 },
      ])?.id,
    ).toBe("y");
    expect(defaultTracker([])).toBeNull();
  });
});
