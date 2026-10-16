import { describe, expect, it } from "vitest";
import { buildWeeklySeries } from "./searchPerformanceWeekly";

const day = (date: string, clicks: number) => ({
  date,
  clicks,
  impressions: clicks * 10,
});

describe("buildWeeklySeries", () => {
  // 2026-08-10 is a Monday; launch 2026-08-15 is the Saturday of that week.
  const daily = [
    day("2026-08-03", 1),
    day("2026-08-09", 1),
    day("2026-08-10", 2),
    day("2026-08-16", 2),
    day("2026-08-17", 5),
    day("2026-08-23", 5),
    day("2026-08-24", 9),
  ];

  it("groups Monday to Sunday weeks and flags the week holding launch", () => {
    const weeks = buildWeeklySeries(daily, "2026-08-15", "2026-08-30");
    expect(weeks.map((w) => [w.key, w.clicks, w.impressions])).toEqual([
      ["2026-08-03", 2, 20],
      ["2026-08-10", 4, 40],
      ["2026-08-17", 10, 100],
      ["2026-08-24", 9, 90],
    ]);
    expect(weeks.map((w) => w.preLaunch)).toEqual([true, false, false, false]);
    expect(weeks.map((w) => w.straddlesLaunch)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("drops the unfinished current week", () => {
    const weeks = buildWeeklySeries(daily, "2026-08-15", "2026-08-25");
    expect(weeks.map((w) => w.key)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
    const shorter = buildWeeklySeries(daily, "2026-08-15", "2026-08-20");
    expect(shorter.map((w) => w.key)).toEqual(["2026-08-03", "2026-08-10"]);
  });
});
