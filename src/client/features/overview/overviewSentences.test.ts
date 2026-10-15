import { describe, expect, it } from "vitest";
import { buildKpi } from "./overviewMetrics";
import { buildWhatChanged, type SentenceInput } from "./overviewSentences";

const base: SentenceInput = {
  currentLabel: "WINDOW_A",
  compareLabel: "WINDOW_B",
  kpis: {},
  rankings: null,
  newPages: null,
};

describe("buildWhatChanged", () => {
  it("names both windows and the direction for a count", () => {
    const [sentence] = buildWhatChanged({
      ...base,
      kpis: { clicks: buildKpi({ key: "clicks", current: 120, base: 100 }) },
    });
    expect(sentence).toBe(
      "Clicks from Google Search were up 20%: 120 in WINDOW_A against 100 in WINDOW_B.",
    );
  });

  it("drops the percentage when the starting number is small", () => {
    const [sentence] = buildWhatChanged({
      ...base,
      kpis: { keyEvents: buildKpi({ key: "keyEvents", current: 4, base: 1 }) },
    });
    expect(sentence).toContain("4 in WINDOW_A against 1 in WINDOW_B");
    expect(sentence).toContain("no percentage is shown");
    expect(sentence).not.toContain("%");
  });

  it("calls a tiny move about the same", () => {
    const [sentence] = buildWhatChanged({
      ...base,
      kpis: { clicks: buildKpi({ key: "clicks", current: 1005, base: 1000 }) },
    });
    expect(sentence).toContain("about the same");
  });

  it("scales the reference before comparing", () => {
    const [sentence] = buildWhatChanged({
      ...base,
      kpis: {
        clicks: buildKpi({ key: "clicks", current: 200, base: 100, scale: 2 }),
      },
    });
    expect(sentence).toContain("about the same");
    expect(sentence).toContain("200 in WINDOW_A against 200 in WINDOW_B");
  });

  it("says lower position is better and which way it moved", () => {
    const [sentence] = buildWhatChanged({
      ...base,
      kpis: { position: buildKpi({ key: "position", current: 8, base: 10 }) },
    });
    expect(sentence).toContain("2.0 places closer to the top");
    expect(sentence).toContain("Lower is better");
  });

  it("skips metrics with no reference rather than guessing", () => {
    const sentences = buildWhatChanged({
      ...base,
      kpis: { clicks: buildKpi({ key: "clicks", current: 5, base: null }) },
    });
    expect(sentences).toEqual([]);
  });

  it("flags a partial rank run and a missing earlier run", () => {
    const [sentence] = buildWhatChanged({
      ...base,
      rankings: {
        device: "desktop",
        total: 128,
        checked: 109,
        latestLabel: "RUN_A",
        topTenNow: 12,
        topTenBefore: null,
        previousLabel: null,
      },
    });
    expect(sentence).toContain("checked 109 of 128");
    expect(sentence).toContain("no earlier complete run");
    expect(sentence).toContain("can undercount");
  });

  it("never compares key events when the windows span the launch", () => {
    const keyEvents = buildKpi({ key: "keyEvents", current: 6, base: 40 });
    const [sentence] = buildWhatChanged({
      ...base,
      kpis: { keyEvents },
      keyEventsNotComparable: true,
    });
    expect(sentence).toBe(
      "Key events from organic search visits were 6 in WINDOW_A. Tracking changed at launch, so earlier counts are not comparable.",
    );
    expect(sentence).not.toMatch(/down|up|same|WINDOW_B/);
  });

  it("returns at most five sentences", () => {
    const kpi = (key: "clicks" | "impressions" | "sessions" | "keyEvents") =>
      buildKpi({ key, current: 50, base: 20 });
    const sentences = buildWhatChanged({
      ...base,
      kpis: {
        clicks: kpi("clicks"),
        impressions: kpi("impressions"),
        sessions: kpi("sessions"),
        keyEvents: kpi("keyEvents"),
        position: buildKpi({ key: "position", current: 5, base: 9 }),
      },
      rankings: {
        device: "desktop",
        total: 10,
        checked: 10,
        latestLabel: "A",
        topTenNow: 3,
        topTenBefore: 2,
        previousLabel: "B",
      },
      newPages: { count: 2, lookbackLabel: "LOOKBACK", maybeIncomplete: false },
    });
    expect(sentences).toHaveLength(5);
  });
});
