import { launchComparison } from "@/client/features/overview/overviewRange";
import {
  daysBetween,
  type AveragedPeriod,
  type DateSpan,
  type DayPoint,
} from "./trafficMath";

function sumPeriod(days: DayPoint[], span: DateSpan): AveragedPeriod {
  const inside = days.filter(
    (day) => day.date >= span.start && day.date <= span.end,
  );
  const length = daysBetween(span.start, span.end);
  const weeks = length / 7;
  const sum = (field: "sessions" | "users" | "keyEvents") =>
    inside.reduce((total, day) => total + day[field], 0);
  return {
    ...span,
    periods: weeks,
    days: length,
    averages: {
      sessions: sum("sessions") / weeks,
      users: sum("users") / weeks,
      keyEvents: sum("keyEvents") / weeks,
    },
  };
}

/** The Overview's comparison on Traffic numbers: launch day through the latest
 *  data day against the 12 weeks before launch. Both are shown per week, so
 *  the percent change equals the Overview's "scaled to the same number of
 *  days". Baseline is null when GA4 history does not reach back 12 weeks
 *  before launch; post is null until launch has data. */
export function launchWindowPeriods(
  days: DayPoint[],
  coverage: DateSpan,
  launch: string,
): { post: AveragedPeriod | null; baseline: AveragedPeriod | null } {
  const pair = launchComparison(launch, coverage.end);
  if (!pair) return { post: null, baseline: null };
  const referenceCovered =
    pair.reference.start >= coverage.start &&
    pair.reference.end <= coverage.end;
  return {
    post: sumPeriod(days, pair.current),
    baseline: referenceCovered ? sumPeriod(days, pair.reference) : null,
  };
}
