import {
  percentChange,
  type DateSpan,
  type DayPoint,
} from "@/client/features/traffic/trafficMath";

export type KpiKey =
  | "keyEvents"
  | "sessions"
  | "clicks"
  | "impressions"
  | "position";

export type Kpi = {
  key: KpiKey;
  current: number | null;
  /** Reference value, already scaled to the current window length. */
  base: number | null;
  absolute: number | null;
  percent: number | null;
  trend: "up" | "down" | "flat" | null;
  /** Whether the move is good news; null when flat or unknown. Average
   *  position is better when it falls. */
  better: boolean | null;
};

type Ga4Totals = { sessions: number; keyEvents: number };

/** Sum organic sessions and key events over a window of dense daily points. */
export function sumGa4(days: DayPoint[], span: DateSpan): Ga4Totals {
  let sessions = 0;
  let keyEvents = 0;
  for (const day of days) {
    if (day.date < span.start || day.date > span.end) continue;
    sessions += day.sessions;
    keyEvents += day.keyEvents;
  }
  return { sessions, keyEvents };
}

export function covers(coverage: DateSpan, span: DateSpan): boolean {
  return span.start >= coverage.start && span.end <= coverage.end;
}

/** Position moves smaller than this many places read as flat. */
const POSITION_FLAT_BELOW = 0.1;
/** Percent moves smaller than this read as flat. */
const PERCENT_FLAT_BELOW = 1;

export function buildKpi(input: {
  key: KpiKey;
  current: number | null;
  base: number | null;
  scale?: number;
}): Kpi {
  const { key, current } = input;
  const base = input.base === null ? null : input.base * (input.scale ?? 1);
  if (current === null || base === null) {
    return {
      key,
      current,
      base,
      absolute: null,
      percent: null,
      trend: null,
      better: null,
    };
  }
  const absolute = current - base;
  const percent = key === "position" ? null : percentChange(current, base);
  const flat =
    key === "position"
      ? Math.abs(absolute) < POSITION_FLAT_BELOW
      : percent === null
        ? absolute === 0
        : Math.abs(percent) < PERCENT_FLAT_BELOW;
  const trend = flat ? "flat" : absolute > 0 ? "up" : "down";
  const better =
    trend === "flat"
      ? null
      : key === "position"
        ? trend === "down"
        : trend === "up";
  return { key, current, base, absolute, percent, trend, better };
}
