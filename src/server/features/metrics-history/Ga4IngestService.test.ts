import { describe, expect, it, vi } from "vitest";
import { toIsoDate } from "@/server/features/ga4/services/Ga4TrafficHistoryService";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/runBatch", () => ({ runBatch: vi.fn() }));

const { ga4RowsToDaily } = await import("./Ga4IngestService");

const row = (dims: string[], metrics: string[]) => ({
  dimensionValues: dims.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value })),
});

describe("ga4RowsToDaily", () => {
  it("converts YYYYMMDD and shapes total rows", () => {
    expect(toIsoDate("20260102")).toBe("2026-01-02");
    expect(
      ga4RowsToDaily("total", [row(["20260102"], ["10", "8", "6", "2"])]),
    ).toEqual([
      {
        date: "2026-01-02",
        sessions: 10,
        activeUsers: 8,
        engagedSessions: 6,
        keyEvents: 2,
      },
    ]);
  });

  it("shapes channel rows", () => {
    expect(
      ga4RowsToDaily("channel", [
        row(["20260102", "Organic Search"], ["5", "4", "3", "1"]),
      ]),
    ).toEqual([
      {
        date: "2026-01-02",
        channelGroup: "Organic Search",
        sessions: 5,
        activeUsers: 4,
        engagedSessions: 3,
        keyEvents: 1,
      },
    ]);
  });

  it("shapes landing page rows", () => {
    expect(
      ga4RowsToDaily("landingPage", [
        row(["20260102", "Direct", "/home"], ["7", "5", "1"]),
      ]),
    ).toEqual([
      {
        date: "2026-01-02",
        channelGroup: "Direct",
        landingPage: "/home",
        sessions: 7,
        engagedSessions: 5,
        keyEvents: 1,
      },
    ]);
  });

  it("shapes key event rows", () => {
    expect(
      ga4RowsToDaily("keyEvent", [
        row(["20260102", "Direct", "purchase"], ["3", "2"]),
      ]),
    ).toEqual([
      {
        date: "2026-01-02",
        channelGroup: "Direct",
        eventName: "purchase",
        keyEvents: 3,
        totalUsers: 2,
      },
    ]);
  });

  it("drops rows with a malformed date and zeroes bad numbers", () => {
    expect(
      ga4RowsToDaily("total", [row(["bad"], ["1", "1", "1", "1"])]),
    ).toEqual([]);
    expect(
      ga4RowsToDaily("total", [row(["20260102"], ["x", "1", "1", "1"])])[0]
        ?.sessions,
    ).toBe(0);
  });
});
