import { sort } from "remeda";
import { addDays, weekStart } from "@/client/features/traffic/trafficMath";

export type DailySearchPoint = {
  date: string;
  clicks: number;
  impressions: number;
};

export type WeeklySearchPoint = {
  /** Monday the week starts on. */
  key: string;
  clicks: number;
  impressions: number;
  /** The whole week is before the launch date. */
  preLaunch: boolean;
  /** The week holds both old-site and new-site days, so it is not a clean
   *  before or after reading. */
  straddlesLaunch: boolean;
};

/** Group daily Search Console rows into Monday to Sunday weeks. Weeks that end
 *  after `latest` are dropped so a half-finished week never reads as a dip. */
export function buildWeeklySeries(
  daily: DailySearchPoint[],
  launch: string,
  latest: string,
): WeeklySearchPoint[] {
  const weeks = new Map<string, WeeklySearchPoint>();
  for (const day of daily) {
    const key = weekStart(day.date);
    const existing = weeks.get(key);
    if (existing) {
      existing.clicks += day.clicks;
      existing.impressions += day.impressions;
      continue;
    }
    const end = addDays(key, 6);
    weeks.set(key, {
      key,
      clicks: day.clicks,
      impressions: day.impressions,
      preLaunch: end < launch,
      straddlesLaunch: key < launch && end >= launch,
    });
  }
  const complete = [...weeks.values()].filter(
    (week) => addDays(week.key, 6) <= latest,
  );
  return sort(complete, (a, b) => a.key.localeCompare(b.key));
}
