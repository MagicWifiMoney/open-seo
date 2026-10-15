import { describe, expect, it } from "vitest";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import {
  bandOf,
  buildRankingsView,
  defaultTracker,
  type PositionCell,
  type RunCoverage,
} from "./overviewRankBands";

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

const dev = (position: number | null, hasCheck: boolean | undefined) => ({
  position,
  previousPosition: null,
  rankingUrl: null,
  serpFeatures: [],
  hasCheck,
});
const row = (
  id: string,
  position: number | null,
  hasCheck: boolean | undefined = true,
): RankTrackingRow =>
  ({
    trackingKeywordId: id,
    keyword: `kw ${id}`,
    desktop: dev(position, hasCheck),
    mobile: dev(null, false),
  }) as unknown as RankTrackingRow;
const rowNoFlag = (id: string): RankTrackingRow => {
  const base = row(id, null, false);
  return {
    ...base,
    desktop: { ...base.desktop, hasCheck: undefined },
  };
};
const rowsFor = (ids: string[]) => ids.map((id) => row(id, null, false));

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
    expect(
      buildRankingsView({
        runs: [],
        cells: [],
        names,
        latestRows: [],
        device: "desktop",
      }),
    ).toBeNull();
  });

  it("reports coverage and does not count unchecked keywords as not ranking", () => {
    const view = buildRankingsView({
      runs: [run("r1", { top3: 1, notRanking: 1, notChecked: 2 })],
      cells: [cell("r1", "a", 2), cell("r1", "b", null)],
      names,
      latestRows: [row("a", 2), row("b", null), ...rowsFor(["c", "d"])],
      device: "desktop",
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
      latestRows: [row("a", 2), row("b", 12), row("c", 6), row("d", null)],
      device: "desktop",
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
      latestRows: [row("a", 1)],
      device: "desktop",
    });
    expect(view?.bands[0].count).toBe(1);
  });
});

describe("buildRankingsView newest check basis", () => {
  const six = new Map(
    ["a", "b", "c", "d", "e", "f"].map((id) => [id, `kw ${id}`]),
  );

  it("counts the newest check per keyword and excludes never-checked ones", () => {
    // a, b checked in an older full run; c, d only in a newer subset run;
    // e, f never checked.
    const view = buildRankingsView({
      runs: [
        run("r1", { top3: 1, notRanking: 1, notChecked: 4 }),
        run("r2", { top4to10: 1, notRanking: 1, notChecked: 4 }),
      ],
      cells: [
        cell("r1", "a", 2),
        cell("r1", "b", null),
        cell("r2", "c", 7),
        cell("r2", "d", null),
      ],
      names: six,
      latestRows: [
        row("a", 2),
        row("b", null),
        row("c", 7),
        row("d", null),
        row("e", null, false),
        rowNoFlag("f"),
      ],
      device: "desktop",
      latestCheckedAt: "2026-10-01 10:00:00",
    });
    expect(view).toMatchObject({ checked: 4, total: 6, partial: true });
    expect(view?.bands.find((b) => b.key === "none")?.count).toBe(2);
    expect(view?.bands.find((b) => b.key === "top3")?.count).toBe(1);
    expect(view?.bands.find((b) => b.key === "top10")?.count).toBe(1);
    expect(view?.topTenNow).toBe(2);
    expect(view?.latest.checkedAt).toBe("2026-10-01 10:00:00");
  });

  it("takes before counts only from the previous complete run", () => {
    const view = buildRankingsView({
      runs: [
        run("r1", { top3: 2, notRanking: 1 }),
        run("r2", { top3: 1, notChecked: 2 }),
      ],
      cells: [
        cell("r1", "a", 1),
        cell("r1", "b", 2),
        cell("r1", "c", null),
        cell("r2", "a", 1),
      ],
      names,
      latestRows: [row("a", 1), row("b", 3), row("c", 5)],
      device: "desktop",
    });
    expect(view?.previous?.runId).toBe("r1");
    expect(view?.topTenBefore).toBe(2);
    expect(view?.topTenNow).toBe(3);
    expect(view?.bands.find((b) => b.key === "none")?.before).toBe(1);
    expect(view?.entered).toEqual(["kw c"]);
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
