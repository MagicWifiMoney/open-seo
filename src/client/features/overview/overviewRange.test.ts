import { describe, expect, it } from "vitest";
import {
  latestDataDate,
  lookbackWindow,
  preLaunchWindow,
  resolveCompare,
  resolveWindow,
  subtractMonths,
} from "./overviewRange";

const LAUNCH = "2026-08-15";
const ASOF = "2026-10-12";

describe("resolveWindow", () => {
  it("ends 28 days at the latest data day", () => {
    expect(
      resolveWindow({ range: "last_28_days", asOf: ASOF, launch: LAUNCH }),
    ).toEqual({ start: "2026-09-15", end: ASOF });
  });

  it("covers six calendar months", () => {
    expect(
      resolveWindow({ range: "last_6_months", asOf: ASOF, launch: LAUNCH }),
    ).toEqual({ start: "2026-04-13", end: ASOF });
  });

  it("runs since launch, or is null before launch", () => {
    expect(
      resolveWindow({ range: "since_launch", asOf: ASOF, launch: LAUNCH }),
    ).toEqual({ start: LAUNCH, end: ASOF });
    expect(
      resolveWindow({
        range: "since_launch",
        asOf: "2026-08-01",
        launch: LAUNCH,
      }),
    ).toBeNull();
  });

  it("uses the 12 weeks before launch for pre-launch", () => {
    expect(
      resolveWindow({ range: "pre_launch", asOf: ASOF, launch: LAUNCH }),
    ).toEqual({ start: "2026-05-23", end: "2026-08-14" });
  });

  it("orders and clamps a custom range, and needs both ends", () => {
    expect(
      resolveWindow({
        range: "custom",
        asOf: ASOF,
        launch: LAUNCH,
        from: "2026-10-30",
        to: "2026-10-01",
      }),
    ).toEqual({ start: "2026-10-01", end: ASOF });
    expect(
      resolveWindow({
        range: "custom",
        asOf: ASOF,
        launch: LAUNCH,
        from: "2026-10-01",
      }),
    ).toBeNull();
  });
});

describe("resolveCompare", () => {
  const current = { start: "2026-09-15", end: ASOF };

  it("takes the same number of days right before", () => {
    expect(
      resolveCompare({ compare: "previous_period", current, launch: LAUNCH }),
    ).toMatchObject({ start: "2026-08-18", end: "2026-09-14", scale: 1 });
  });

  it("lines weekdays up for last year", () => {
    expect(
      resolveCompare({ compare: "last_year", current, launch: LAUNCH }),
    ).toMatchObject({ start: "2025-09-16", end: "2025-10-13" });
  });

  it("goes back six calendar months", () => {
    expect(
      resolveCompare({ compare: "six_months_ago", current, launch: LAUNCH }),
    ).toMatchObject({ start: "2026-03-15", end: "2026-04-12" });
  });

  it("rescales the pre-launch window to the current length", () => {
    const result = resolveCompare({
      compare: "pre_launch_avg",
      current,
      launch: LAUNCH,
    });
    expect(result).toMatchObject({ start: "2026-05-23", end: "2026-08-14" });
    expect(result?.isAverage).toBe(true);
    expect(result?.scale).toBeCloseTo(28 / 84, 10);
  });
});

describe("date helpers", () => {
  it("clamps the day when the target month is shorter", () => {
    expect(subtractMonths("2026-08-31", 6)).toBe("2026-02-28");
  });

  it("applies the data lag", () => {
    expect(latestDataDate("2026-10-15")).toBe(ASOF);
  });

  it("builds the pre-launch and lookback windows", () => {
    expect(preLaunchWindow(LAUNCH).end).toBe("2026-08-14");
    expect(lookbackWindow(LAUNCH).end).toBe("2026-08-14");
  });
});
