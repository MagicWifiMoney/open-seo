import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { describeDelta } from "./insightsFormat";
import { InsightsKpiRow } from "./InsightsKpiRow";

const totals = { clicks: 1200, impressions: 50_000, ctr: 0.024, position: 7.2 };
const deltas = {
  clicks: { absolute: 200, percent: 20 },
  impressions: { absolute: -1000, percent: -1.96 },
  ctr: { absolute: 0.004, percent: 20 },
  // rank moved from 8.0 to 7.2: lower is better
  position: { absolute: -0.8, percent: -10 },
};

describe("describeDelta", () => {
  it("formats counts as signed percent", () => {
    expect(describeDelta("count", deltas.clicks)).toEqual({
      text: "+20.0%",
      tone: "good",
    });
    expect(describeDelta("count", deltas.impressions)).toEqual({
      text: "-2.0%",
      tone: "bad",
    });
  });
  it("shows CTR as percentage points", () => {
    expect(describeDelta("ctr", deltas.ctr)).toEqual({
      text: "+0.4 pts",
      tone: "good",
    });
  });
  it("inverts position: a drop in rank number is good", () => {
    expect(describeDelta("position", { absolute: -0.8, percent: -10 })).toEqual(
      {
        text: "-0.8",
        tone: "good",
      },
    );
    expect(describeDelta("position", { absolute: 1.5, percent: 20 })).toEqual({
      text: "+1.5",
      tone: "bad",
    });
    expect(describeDelta("position", { absolute: 0.01, percent: 0 }).tone).toBe(
      "neutral",
    );
  });
  it("falls back to the absolute change when the base was zero", () => {
    expect(describeDelta("count", { absolute: 40, percent: null }).text).toBe(
      "+40",
    );
  });
});

describe("InsightsKpiRow", () => {
  it("renders values and colours position by direction of improvement", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsKpiRow, {
        totals,
        deltas,
        compareLabel: "vs prior",
      }),
    );
    expect(html).toContain("1,200");
    expect(html).toContain("2.4%");
    expect(html).toContain("7.2");
    const position = html.match(
      /<p[^>]*data-testid="delta-position"[^>]*>/,
    )?.[0];
    expect(position).toContain('data-tone="good"');
    expect(position).toContain("text-success");
    const impressions = html.match(
      /<p[^>]*data-testid="delta-impressions"[^>]*>/,
    )?.[0];
    expect(impressions).toContain("text-destructive");
  });
  it("says no comparison without deltas", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsKpiRow, { totals, deltas: null, compareLabel: "" }),
    );
    expect(html).toContain("No comparison");
  });
});
