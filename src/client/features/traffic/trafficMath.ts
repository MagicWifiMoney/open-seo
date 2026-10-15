import type {
  TrafficGranularity,
  TrafficMetric,
  TrafficRange,
} from "@/types/schemas/traffic";

/** One day of traffic, as returned by the history server function. */
export type DayPoint = {
  date: string;
  sessions: number;
  users: number;
  keyEvents: number;
};

export type DateSpan = { start: string; end: string };

export type Bucket = DateSpan & {
  sessions: number;
  users: number;
  keyEvents: number;
  dayCount: number;
  /** True only when every day of the bucket lies inside data coverage. */
  complete: boolean;
};

export type Averages = { sessions: number; users: number; keyEvents: number };

export type AveragedPeriod = DateSpan & {
  /** Number of complete weeks (or months) averaged. */
  periods: number;
  averages: Averages;
};

const DAY_MS = 86_400_000;

export function metricField(
  metric: TrafficMetric,
): "sessions" | "users" | "keyEvents" {
  return metric === "key_events" ? "keyEvents" : metric;
}

function parse(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addDays(date: string, days: number): string {
  const value = parse(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Inclusive day count. */
export function daysBetween(start: string, end: string): number {
  return (
    Math.round((parse(end).valueOf() - parse(start).valueOf()) / DAY_MS) + 1
  );
}

/** Monday of the week containing `date` (weeks run Monday to Sunday). */
export function weekStart(date: string): string {
  const day = parse(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function monthEnd(date: string): string {
  const value = parse(monthStart(date));
  value.setUTCMonth(value.getUTCMonth() + 1);
  value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
}

export function bucketStart(date: string, g: TrafficGranularity): string {
  if (g === "day") return date;
  return g === "week" ? weekStart(date) : monthStart(date);
}

export function bucketEnd(start: string, g: TrafficGranularity): string {
  if (g === "day") return start;
  return g === "week" ? addDays(start, 6) : monthEnd(start);
}

/** Zero-fill the sparse GA4 rows across the coverage window. GA4 omits days
 *  with no traffic; treating them as zero keeps sums and averages honest. */
export function fillDays(days: DayPoint[], coverage: DateSpan): DayPoint[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const filled: DayPoint[] = [];
  for (
    let date = coverage.start;
    date <= coverage.end;
    date = addDays(date, 1)
  ) {
    filled.push(
      byDate.get(date) ?? { date, sessions: 0, users: 0, keyEvents: 0 },
    );
  }
  return filled;
}

/** Group dense daily points into day/week/month buckets. A bucket is
 *  complete only when its whole span lies inside `coverage`. */
export function buildBuckets(
  days: DayPoint[],
  g: TrafficGranularity,
  coverage: DateSpan,
): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const day of days) {
    const start = bucketStart(day.date, g);
    const existing = buckets.get(start);
    if (existing) {
      existing.sessions += day.sessions;
      existing.users += day.users;
      existing.keyEvents += day.keyEvents;
      existing.dayCount += 1;
      continue;
    }
    const end = bucketEnd(start, g);
    buckets.set(start, {
      start,
      end,
      sessions: day.sessions,
      users: day.users,
      keyEvents: day.keyEvents,
      dayCount: 1,
      complete: start >= coverage.start && end <= coverage.end,
    });
  }
  // Map keeps insertion order and `days` is chronological, so already sorted.
  return [...buckets.values()];
}

export function completeBuckets(buckets: Bucket[]): Bucket[] {
  return buckets.filter((bucket) => bucket.complete);
}

export function averageOf(buckets: Bucket[]): Averages | null {
  if (buckets.length === 0) return null;
  const sum = buckets.reduce(
    (acc, bucket) => ({
      sessions: acc.sessions + bucket.sessions,
      users: acc.users + bucket.users,
      keyEvents: acc.keyEvents + bucket.keyEvents,
    }),
    { sessions: 0, users: 0, keyEvents: 0 },
  );
  return {
    sessions: sum.sessions / buckets.length,
    users: sum.users / buckets.length,
    keyEvents: sum.keyEvents / buckets.length,
  };
}

function toPeriod(buckets: Bucket[]): AveragedPeriod | null {
  const averages = averageOf(buckets);
  if (!averages) return null;
  return {
    start: buckets[0].start,
    end: buckets[buckets.length - 1].end,
    periods: buckets.length,
    averages,
  };
}

/** Pre-launch baseline: average of complete weeks (or months) that end the
 *  day before launch or earlier, starting at the first day of data. */
export function baselineAverage(
  days: DayPoint[],
  g: Exclude<TrafficGranularity, "day">,
  coverage: DateSpan,
  launch: string,
): AveragedPeriod | null {
  const buckets = completeBuckets(buildBuckets(days, g, coverage)).filter(
    (bucket) => bucket.end < launch,
  );
  return toPeriod(buckets);
}

/** Post-launch average: complete weeks (or months) that start on or after
 *  the launch date. */
export function postLaunchAverage(
  days: DayPoint[],
  g: Exclude<TrafficGranularity, "day">,
  coverage: DateSpan,
  launch: string,
): AveragedPeriod | null {
  const buckets = completeBuckets(buildBuckets(days, g, coverage)).filter(
    (bucket) => bucket.start >= launch,
  );
  return toPeriod(buckets);
}

/** The same weeks one year earlier, aligned to the weekday (52 weeks = 364
 *  days back) so Monday-to-Sunday weeks line up. Null when that window is not
 *  fully inside data coverage. */
export function yoyAverage(
  days: DayPoint[],
  period: DateSpan,
  coverage: DateSpan,
): AveragedPeriod | null {
  const start = addDays(period.start, -364);
  const end = addDays(period.end, -364);
  if (start < coverage.start || end > coverage.end) return null;
  const weeks = completeBuckets(
    buildBuckets(
      days.filter((day) => day.date >= start && day.date <= end),
      "week",
      coverage,
    ),
  );
  return toPeriod(weeks);
}

/** Percent change from `base` to `current`; null when the base is zero. */
export function percentChange(current: number, base: number): number | null {
  if (base === 0) return null;
  return ((current - base) / base) * 100;
}

export type Delta = { absolute: number; percent: number | null };

export function delta(current: number, base: number): Delta {
  return { absolute: current - base, percent: percentChange(current, base) };
}

export type MetricComparison = {
  metric: TrafficMetric;
  current: number;
  base: number;
  delta: Delta;
};

/** Key events are not like-for-like across the launch (the old site fired a
 *  different event), so they never get a comparison. */
export function isComparableAcrossLaunch(metric: TrafficMetric): boolean {
  return metric !== "key_events";
}

/** Post-launch average vs a reference average. Key events are null: see
 *  isComparableAcrossLaunch. */
export function compareAverages(
  current: Averages,
  base: Averages,
): Record<TrafficMetric, MetricComparison | null> {
  const make = (metric: TrafficMetric): MetricComparison => {
    const field = metricField(metric);
    return {
      metric,
      current: current[field],
      base: base[field],
      delta: delta(current[field], base[field]),
    };
  };
  return {
    sessions: make("sessions"),
    users: make("users"),
    key_events: null,
  };
}

/** Resolve a range preset to concrete dates, clamped to data coverage. */
export function resolveRange(input: {
  range: TrafficRange;
  coverage: DateSpan;
  launch: string;
  from?: string;
  to?: string;
}): DateSpan {
  const { range, coverage, launch } = input;
  const clamp = (start: string, end: string): DateSpan => {
    const lo = start < coverage.start ? coverage.start : start;
    const hi = end > coverage.end ? coverage.end : end;
    return lo > hi
      ? { start: coverage.start, end: coverage.end }
      : { start: lo, end: hi };
  };
  switch (range) {
    case "last_28_days":
      return clamp(addDays(coverage.end, -27), coverage.end);
    case "last_90_days":
      return clamp(addDays(coverage.end, -89), coverage.end);
    case "last_12_months":
      return clamp(addDays(coverage.end, -364), coverage.end);
    case "since_launch":
      return clamp(launch, coverage.end);
    case "pre_launch":
      return clamp(coverage.start, addDays(launch, -1));
    case "custom": {
      const a = input.from ?? coverage.start;
      const b = input.to ?? coverage.end;
      return a <= b ? clamp(a, b) : clamp(b, a);
    }
    default:
      return { start: coverage.start, end: coverage.end };
  }
}

/** Buckets that overlap `range` and are complete within coverage. Partial
 *  buckets (edge of the data) are left out so they cannot read as a dip. */
export function visibleBuckets(
  days: DayPoint[],
  g: TrafficGranularity,
  coverage: DateSpan,
  range: DateSpan,
): { buckets: Bucket[]; partialOmitted: number } {
  const overlapping = buildBuckets(days, g, coverage).filter(
    (bucket) => bucket.end >= range.start && bucket.start <= range.end,
  );
  const buckets = completeBuckets(overlapping);
  return { buckets, partialOmitted: overlapping.length - buckets.length };
}

/** The chart x value that marks the launch: the bucket containing it. */
export function launchBucketKey(
  launch: string,
  g: TrafficGranularity,
  buckets: Bucket[],
): string | null {
  const key = bucketStart(launch, g);
  return buckets.some((bucket) => bucket.start === key) ? key : null;
}

/** Baseline value to draw/compare for one bucket size. Day uses the weekly
 *  baseline divided by seven. */
export function baselineForGranularity(
  days: DayPoint[],
  g: TrafficGranularity,
  coverage: DateSpan,
  launch: string,
): AveragedPeriod | null {
  if (g !== "day") return baselineAverage(days, g, coverage, launch);
  const weekly = baselineAverage(days, "week", coverage, launch);
  if (!weekly) return null;
  return {
    ...weekly,
    periods: weekly.periods * 7,
    averages: {
      sessions: weekly.averages.sessions / 7,
      users: weekly.averages.users / 7,
      keyEvents: weekly.averages.keyEvents / 7,
    },
  };
}
