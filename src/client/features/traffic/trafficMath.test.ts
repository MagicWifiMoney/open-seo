import { describe, expect, it } from "vitest";
import {
  addDays,
  baselineAverage,
  baselineForGranularity,
  buildBuckets,
  compareAverages,
  completeBuckets,
  daysBetween,
  fillDays,
  isComparableAcrossLaunch,
  launchBucketKey,
  monthEnd,
  percentChange,
  postLaunchAverage,
  resolveRange,
  visibleBuckets,
  weekStart,
  yoyAverage,
  type DayPoint,
} from "./trafficMath";

// Fixture series: every day has 10 sessions, 5 users, 1 key event, except where noted.
function series(start: string, end: string, per = { s: 10, u: 5, k: 1 }) {
  const days: DayPoint[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({ date: d, sessions: per.s, users: per.u, keyEvents: per.k });
  }
  return days;
}

describe("date helpers", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-08-15")).toBe("2026-08-10"); // Saturday
    expect(weekStart("2026-08-16")).toBe("2026-08-10"); // Sunday
    expect(weekStart("2026-08-17")).toBe("2026-08-17"); // Monday
  });
  it("finds month ends including leap February", () => {
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(monthEnd("2026-12-05")).toBe("2026-12-31");
  });
  it("counts inclusive days", () => {
    expect(daysBetween("2026-01-01", "2026-01-07")).toBe(7);
  });
});

describe("fillDays", () => {
  it("zero-fills gaps across coverage", () => {
    const filled = fillDays(
      [{ date: "2026-01-02", sessions: 4, users: 3, keyEvents: 1 }],
      { start: "2026-01-01", end: "2026-01-03" },
    );
    expect(filled.map((d) => d.sessions)).toEqual([0, 4, 0]);
  });
});

describe("bucketing and complete-period filtering", () => {
  const coverage = { start: "2026-01-01", end: "2026-02-10" }; // Thu .. Tue
  const days = series(coverage.start, coverage.end);

  it("buckets weeks Monday to Sunday and flags the edges partial", () => {
    const weeks = buildBuckets(days, "week", coverage);
    expect(weeks[0].start).toBe("2025-12-29");
    expect(weeks[0].complete).toBe(false);
    expect(weeks[0].dayCount).toBe(4);
    expect(weeks[1]).toMatchObject({
      start: "2026-01-05",
      end: "2026-01-11",
      complete: true,
      sessions: 70,
    });
    expect(weeks[weeks.length - 1].complete).toBe(false);
    expect(completeBuckets(weeks).every((w) => w.dayCount === 7)).toBe(true);
  });

  it("buckets months and flags a partial last month", () => {
    const months = buildBuckets(days, "month", coverage);
    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({
      start: "2026-01-01",
      end: "2026-01-31",
      complete: true,
      sessions: 310,
    });
    expect(months[1].complete).toBe(false);
  });

  it("treats day buckets as always complete", () => {
    expect(completeBuckets(buildBuckets(days, "day", coverage))).toHaveLength(
      days.length,
    );
  });
});

describe("baseline average", () => {
  const coverage = { start: "2026-01-01", end: "2026-09-30" };
  const launch = "2026-08-15";
  // 10 sessions/day before launch, 20 after.
  const days = [
    ...series("2026-01-01", "2026-08-14"),
    ...series("2026-08-15", "2026-09-30", { s: 20, u: 8, k: 2 }),
  ];

  it("averages only complete pre-launch weeks", () => {
    const base = baselineAverage(days, "week", coverage, launch)!;
    expect(base.start).toBe("2026-01-05");
    // Week of Aug 10 contains the launch (ends Aug 16), so last baseline week is Aug 3-9.
    expect(base.end).toBe("2026-08-09");
    expect(base.averages.sessions).toBe(70);
    expect(base.averages.keyEvents).toBe(7);
    expect(base.periods).toBe(31);
  });

  it("averages only complete pre-launch months", () => {
    const base = baselineAverage(days, "month", coverage, launch)!;
    expect(base.start).toBe("2026-01-01");
    expect(base.end).toBe("2026-07-31");
    expect(base.periods).toBe(7);
  });

  it("derives the daily baseline from the weekly one", () => {
    const base = baselineForGranularity(days, "day", coverage, launch)!;
    expect(base.averages.sessions).toBe(10);
  });

  it("returns null when no complete pre-launch period exists", () => {
    expect(
      baselineAverage(
        series("2026-08-12", "2026-09-30"),
        "week",
        { start: "2026-08-12", end: "2026-09-30" },
        launch,
      ),
    ).toBeNull();
  });

  it("averages complete post-launch weeks from the first full week after launch", () => {
    const post = postLaunchAverage(days, "week", coverage, launch)!;
    expect(post.start).toBe("2026-08-17");
    expect(post.end).toBe("2026-09-27");
    expect(post.periods).toBe(6);
    expect(post.averages.sessions).toBe(140);
  });

  it("returns null post-launch average before a full week has passed", () => {
    const short = { start: "2026-01-01", end: "2026-08-20" };
    expect(
      postLaunchAverage(series(short.start, short.end), "week", short, launch),
    ).toBeNull();
  });
});

describe("post vs baseline math", () => {
  it("computes absolute and percent change for every metric", () => {
    const result = compareAverages(
      { sessions: 140, users: 56, keyEvents: 14 },
      { sessions: 70, users: 35, keyEvents: 7 },
    );
    expect(result.sessions?.delta).toEqual({ absolute: 70, percent: 100 });
    expect(result.users?.delta.percent).toBe(60);
  });
  it("never compares key events across the launch", () => {
    const result = compareAverages(
      { sessions: 140, users: 56, keyEvents: 14 },
      { sessions: 70, users: 35, keyEvents: 7 },
    );
    expect(result.key_events).toBeNull();
    expect(isComparableAcrossLaunch("key_events")).toBe(false);
    expect(isComparableAcrossLaunch("sessions")).toBe(true);
  });
  it("returns null percent for a zero base and handles declines", () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(50, 100)).toBe(-50);
  });
});

describe("year over year alignment", () => {
  const coverage = { start: "2025-06-02", end: "2026-10-11" };
  const days = [
    ...series("2025-06-02", "2025-10-12", { s: 5, u: 3, k: 0 }),
    ...series("2025-10-13", "2026-10-11"),
  ];

  it("shifts a Monday-to-Sunday window back 364 days, staying weekday aligned", () => {
    const yoy = yoyAverage(
      days,
      { start: "2026-08-17", end: "2026-10-11" },
      coverage,
    )!;
    expect(yoy.start).toBe("2025-08-18");
    expect(yoy.end).toBe("2025-10-12");
    expect(weekStart(yoy.start)).toBe(yoy.start);
    expect(yoy.periods).toBe(8);
    expect(yoy.averages.sessions).toBe(35);
  });

  it("returns null when last year is outside coverage", () => {
    expect(
      yoyAverage(
        days,
        { start: "2026-01-05", end: "2026-01-11" },
        { start: "2025-12-01", end: "2026-10-11" },
      ),
    ).toBeNull();
  });
});

describe("range presets", () => {
  const coverage = { start: "2025-06-02", end: "2026-10-11" };
  const launch = "2026-08-15";
  const r = (range: Parameters<typeof resolveRange>[0]["range"], extra = {}) =>
    resolveRange({ range, coverage, launch, ...extra });

  it("resolves each preset", () => {
    expect(r("last_28_days")).toEqual({
      start: "2026-09-14",
      end: "2026-10-11",
    });
    expect(r("last_90_days")).toEqual({
      start: "2026-07-14",
      end: "2026-10-11",
    });
    expect(r("last_12_months")).toEqual({
      start: "2025-10-12",
      end: "2026-10-11",
    });
    expect(r("since_launch")).toEqual({ start: launch, end: "2026-10-11" });
    expect(r("pre_launch")).toEqual({ start: "2025-06-02", end: "2026-08-14" });
    expect(r("all")).toEqual(coverage);
  });
  it("clamps and orders custom ranges", () => {
    expect(r("custom", { from: "2025-01-01", to: "2025-07-01" })).toEqual({
      start: "2025-06-02",
      end: "2025-07-01",
    });
    expect(r("custom", { from: "2026-02-01", to: "2026-01-01" })).toEqual({
      start: "2026-01-01",
      end: "2026-02-01",
    });
    expect(r("custom")).toEqual(coverage);
  });
});

describe("visible buckets and launch marker", () => {
  const coverage = { start: "2026-01-01", end: "2026-10-11" };
  const days = series(coverage.start, coverage.end);
  const range = { start: "2026-08-15", end: "2026-10-11" };

  it("includes the full launch week and omits nothing complete", () => {
    const { buckets } = visibleBuckets(days, "week", coverage, range);
    expect(buckets[0].start).toBe("2026-08-10");
    expect(launchBucketKey("2026-08-15", "week", buckets)).toBe("2026-08-10");
  });
  it("omits the partial trailing week and reports it", () => {
    const { buckets, partialOmitted } = visibleBuckets(
      days,
      "week",
      coverage,
      range,
    );
    expect(buckets[buckets.length - 1].end).toBe("2026-10-11");
    expect(partialOmitted).toBe(0);
    const early = visibleBuckets(
      series(coverage.start, "2026-10-08"),
      "week",
      { start: coverage.start, end: "2026-10-08" },
      range,
    );
    expect(early.partialOmitted).toBe(1);
  });
  it("returns no marker when launch is outside the range", () => {
    const { buckets } = visibleBuckets(days, "week", coverage, {
      start: "2026-01-05",
      end: "2026-03-01",
    });
    expect(launchBucketKey("2026-08-15", "week", buckets)).toBeNull();
  });
});
