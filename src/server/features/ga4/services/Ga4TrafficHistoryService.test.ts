import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: vi.fn() },
}));

vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: vi.fn() }),
}));

import {
  buildTrafficHistoryRequest,
  rowsToDays,
  toIsoDate,
} from "./Ga4TrafficHistoryService";

describe("Ga4TrafficHistoryService helpers", () => {
  it("converts GA4 YYYYMMDD dates", () => {
    expect(toIsoDate("20260815")).toBe("2026-08-15");
    expect(toIsoDate("2026-08-15")).toBeNull();
  });

  it("maps normalized rows to days and skips malformed ones", () => {
    expect(
      rowsToDays([
        { date: "20260101", sessions: 4, activeUsers: 3, keyEvents: 1 },
        { date: "bad", sessions: 9, activeUsers: 9, keyEvents: 9 },
        { date: "20260102", sessions: 2, activeUsers: null, keyEvents: 0 },
      ]),
    ).toEqual([
      { date: "2026-01-01", sessions: 4, users: 3, keyEvents: 1 },
      { date: "2026-01-02", sessions: 2, users: 0, keyEvents: 0 },
    ]);
  });

  it("filters by channel group only for a specific channel", () => {
    const base = { startDate: "2025-01-01", endDate: "2025-01-31", offset: 0 };
    expect(
      buildTrafficHistoryRequest({ ...base, channel: "all" }).dimensionFilter,
    ).toBeUndefined();
    expect(
      buildTrafficHistoryRequest({ ...base, channel: "organic_search" })
        .dimensionFilter,
    ).toEqual({
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { matchType: "EXACT", value: "Organic Search" },
      },
    });
  });
});
