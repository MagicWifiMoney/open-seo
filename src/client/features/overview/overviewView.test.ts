import { describe, expect, it } from "vitest";
import { buildOverviewView } from "./overviewView";

const current = { start: "2026-09-15", end: "2026-10-12" };
const reference = {
  start: "2026-08-18",
  end: "2026-09-14",
  scale: 1,
  isAverage: false,
};
const base = {
  current,
  reference,
  ga4: null,
  gsc: null,
  rankView: null,
  hasTracker: false,
  device: "desktop" as const,
  launch: "2026-08-15",
  launchInPast: true,
  lookbackEnd: "2026-08-14",
};
const gsc = {
  connected: true as const,
  totals: { clicks: 120, impressions: 4000, ctr: 0.03, position: 9 },
  compareTotals: { clicks: 100, impressions: 0, ctr: 0, position: 0 },
  pages: [
    {
      key: "https://example.com/a",
      clicks: 5,
      impressions: 50,
      ctr: 0.1,
      position: 4,
    },
  ],
  pagesTruncated: false,
  comparePages: [],
  newPages: [
    {
      key: "https://example.com/a",
      clicks: 5,
      impressions: 50,
      ctr: 0.1,
      position: 4,
    },
  ],
  lookbackTruncated: false,
  lookbackStart: "2025-06-01",
};

describe("buildOverviewView", () => {
  it("builds no cards when no source is connected", () => {
    expect(buildOverviewView(base).cards).toEqual([]);
  });

  it("leads with key events and skips position when the reference had no impressions", () => {
    const view = buildOverviewView({
      ...base,
      gsc,
      ga4: {
        connected: true,
        dataStart: "2026-08-01",
        dataEnd: "2026-10-12",
        days: [{ date: "2026-10-01", sessions: 3, users: 3, keyEvents: 2 }],
      } as never,
    });
    expect(view.cards.map((card) => card.kpi.key)).toEqual([
      "keyEvents",
      "sessions",
      "clicks",
      "impressions",
      "position",
    ]);
    const position = view.cards.find((card) => card.kpi.key === "position");
    expect(position?.kpi.base).toBeNull();
    expect(view.sentences.join(" ")).not.toContain("$");
  });

  it("only lists new pages when the before-launch history was read", () => {
    expect(buildOverviewView({ ...base, gsc }).newRows).toHaveLength(1);
    expect(
      buildOverviewView({ ...base, gsc: { ...gsc, newPages: null as never } })
        .newRows,
    ).toBeNull();
  });
});

describe("key events across launch", () => {
  const ga4 = {
    connected: true,
    dataStart: "2026-06-01",
    dataEnd: "2026-10-12",
    days: [{ date: "2026-10-01", sessions: 3, users: 3, keyEvents: 2 }],
  } as never;

  it("shows the value but no delta when the compare window is before launch", () => {
    const view = buildOverviewView({ ...base, ga4, launch: "2026-09-01" });
    const card = view.cards.find((c) => c.kpi.key === "keyEvents");
    expect(card?.kpi.current).toBe(2);
    expect(card?.kpi.base).toBeNull();
    expect(card?.note).toBe(
      "Tracking changed at launch, so earlier counts are not comparable.",
    );
    const sessions = view.cards.find((c) => c.kpi.key === "sessions");
    expect(sessions?.kpi.base).not.toBeNull();
  });

  it("compares when both windows are after launch", () => {
    const view = buildOverviewView({
      ...base,
      ga4,
      launch: "2026-08-01",
    });
    const card = view.cards.find((c) => c.kpi.key === "keyEvents");
    expect(card?.kpi.base).not.toBeNull();
    expect(card?.note).toBeUndefined();
  });
});
