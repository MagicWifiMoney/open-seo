import { describe, expect, it } from "vitest";
import { launchWindowPeriods } from "./trafficLaunchWindow";
import {
  fillDays,
  resolveRange,
  straddlesLaunch,
  type DayPoint,
} from "./trafficMath";
import { buildTableRows } from "./trafficCsv";
import { buildBuckets } from "./trafficMath";

const launch = "2026-08-15";
const coverage = { start: "2026-01-01", end: "2026-10-13" };

function flat(sessionsPerDay: (date: string) => number): DayPoint[] {
  return fillDays([], coverage).map((day) => ({
    ...day,
    sessions: sessionsPerDay(day.date),
  }));
}

describe("launchWindowPeriods", () => {
  it("compares launch to latest day with the 12 weeks before, per week", () => {
    const days = flat((date) => (date >= launch ? 20 : 10));
    const { post, baseline } = launchWindowPeriods(days, coverage, launch);
    expect(post).toMatchObject({
      start: "2026-08-15",
      end: "2026-10-13",
      days: 60,
    });
    expect(baseline).toMatchObject({
      start: "2026-05-23",
      end: "2026-08-14",
      days: 84,
    });
    expect(post?.averages.sessions).toBeCloseTo(140);
    expect(baseline?.averages.sessions).toBeCloseTo(70);
  });

  it("has no baseline when history does not reach 12 weeks before launch", () => {
    const short = { start: "2026-07-01", end: "2026-10-13" };
    const { post, baseline } = launchWindowPeriods(
      fillDays([], short),
      short,
      launch,
    );
    expect(post).not.toBeNull();
    expect(baseline).toBeNull();
  });
});

describe("traffic launch range", () => {
  it("launch_window spans 12 weeks before launch through the latest day", () => {
    expect(resolveRange({ range: "launch_window", coverage, launch })).toEqual({
      start: "2026-05-23",
      end: "2026-10-13",
    });
  });
});

describe("launch week", () => {
  it("flags only the week or month holding launch, never a day", () => {
    const week = { start: "2026-08-10", end: "2026-08-16" };
    expect(straddlesLaunch(week, launch, "week")).toBe(true);
    expect(straddlesLaunch(week, launch, "day")).toBe(false);
    expect(
      straddlesLaunch(
        { start: "2026-08-17", end: "2026-08-23" },
        launch,
        "week",
      ),
    ).toBe(false);
    expect(
      straddlesLaunch(
        { start: "2026-08-15", end: "2026-08-21" },
        launch,
        "week",
      ),
    ).toBe(false);
  });

  it("withholds the change for the straddling week", () => {
    const days = flat(() => 10);
    const buckets = buildBuckets(days, "week", coverage).filter(
      (b) => b.start >= "2026-08-03" && b.start <= "2026-08-17",
    );
    const rows = buildTableRows(buckets, 35, "sessions", launch, "week");
    expect(rows.map((r) => [r.start, r.partialOldSite, r.vsBaseline])).toEqual([
      ["2026-08-03", false, 100],
      ["2026-08-10", true, null],
      ["2026-08-17", false, 100],
    ]);
  });
});
