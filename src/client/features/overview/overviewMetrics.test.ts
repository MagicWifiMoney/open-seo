import { describe, expect, it } from "vitest";
import { buildKpi, covers, sumGa4 } from "./overviewMetrics";

describe("buildKpi", () => {
  it("marks a rising count as better and scales the reference", () => {
    const kpi = buildKpi({ key: "clicks", current: 150, base: 100 });
    expect(kpi).toMatchObject({ trend: "up", better: true, percent: 50 });
    const scaled = buildKpi({
      key: "clicks",
      current: 150,
      base: 300,
      scale: 0.5,
    });
    expect(scaled.base).toBe(150);
    expect(scaled.trend).toBe("flat");
  });

  it("treats a falling position as better", () => {
    const kpi = buildKpi({ key: "position", current: 7, base: 9 });
    expect(kpi).toMatchObject({ trend: "down", better: true, percent: null });
  });

  it("has no percent from a zero base and no delta without a base", () => {
    expect(buildKpi({ key: "clicks", current: 3, base: 0 }).percent).toBeNull();
    expect(
      buildKpi({ key: "clicks", current: 3, base: null }).trend,
    ).toBeNull();
  });
});

describe("sumGa4 and covers", () => {
  const days = [
    { date: "2026-01-01", sessions: 1, users: 1, keyEvents: 0 },
    { date: "2026-01-02", sessions: 2, users: 2, keyEvents: 1 },
    { date: "2026-01-03", sessions: 4, users: 3, keyEvents: 1 },
  ];
  it("sums only days inside the window", () => {
    expect(sumGa4(days, { start: "2026-01-02", end: "2026-01-03" })).toEqual({
      sessions: 6,
      keyEvents: 2,
    });
  });
  it("checks coverage", () => {
    const coverage = { start: "2026-01-01", end: "2026-01-03" };
    expect(covers(coverage, { start: "2026-01-02", end: "2026-01-03" })).toBe(
      true,
    );
    expect(covers(coverage, { start: "2025-12-31", end: "2026-01-03" })).toBe(
      false,
    );
  });
});
