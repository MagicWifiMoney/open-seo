import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  runReport: vi.fn(),
  coverageEnd: vi.fn(),
  getTotal: vi.fn(),
  getChannel: vi.fn(),
}));

vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.getConnection },
}));

vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));

vi.mock("@/server/features/metrics-history/MetricsHistoryRepository", () => ({
  MetricsHistoryRepository: {
    getGa4CoverageEnd: mocks.coverageEnd,
    getGa4Total: mocks.getTotal,
    getGa4Channel: mocks.getChannel,
  },
}));

import {
  Ga4TrafficHistoryService,
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

const metrics = (date: string, sessions: number) => ({
  date,
  sessions,
  activeUsers: sessions - 1,
  engagedSessions: 0,
  keyEvents: 2,
});

describe("Ga4TrafficHistoryService.getHistory stored path", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getConnection.mockResolvedValue({
      projectId: "p",
      connectedByUserId: "u",
      ga4AccountId: "a",
      propertyId: "1",
      propertyDisplayName: "Prop",
      propertyTimeZone: "UTC",
    });
  });

  it("serves the all-channel view from stored totals without calling GA4", async () => {
    mocks.coverageEnd.mockResolvedValue("2026-10-15");
    mocks.getTotal.mockResolvedValue([
      metrics("2026-10-01", 5),
      metrics("2026-10-02", 7),
    ]);
    const result = await Ga4TrafficHistoryService.getHistory(
      { projectId: "p", channel: "all" },
      { now },
    );
    expect(mocks.runReport).not.toHaveBeenCalled();
    expect(result).toEqual({
      connected: true,
      propertyDisplayName: "Prop",
      propertyTimeZone: "UTC",
      channel: "all",
      dataStart: "2026-10-01",
      dataEnd: "2026-10-02",
      days: [
        { date: "2026-10-01", sessions: 5, users: 4, keyEvents: 2 },
        { date: "2026-10-02", sessions: 7, users: 6, keyEvents: 2 },
      ],
      hasLimitedData: false,
      truncated: false,
    });
  });

  it("filters stored channel rows to the requested channel group", async () => {
    mocks.coverageEnd.mockResolvedValue("2026-10-15");
    mocks.getChannel.mockResolvedValue([
      { ...metrics("2026-10-01", 3), channelGroup: "Organic Search" },
      { ...metrics("2026-10-01", 9), channelGroup: "Direct" },
    ]);
    const result = await Ga4TrafficHistoryService.getHistory(
      { projectId: "p", channel: "organic_search" },
      { now },
    );
    expect(result?.days).toEqual([
      { date: "2026-10-01", sessions: 3, users: 2, keyEvents: 2 },
    ]);
    expect(mocks.runReport).not.toHaveBeenCalled();
  });

  it("falls back to GA4 when stored coverage is missing or behind", async () => {
    for (const end of [null, "2026-10-01"]) {
      mocks.coverageEnd.mockResolvedValue(end);
      mocks.runReport.mockResolvedValue({
        dimensionHeaders: [{ name: "date" }],
        metricHeaders: [],
        rows: [],
        rowCount: 0,
      });
      await Ga4TrafficHistoryService.getHistory(
        { projectId: "p", channel: "all" },
        { now },
      ).catch(() => undefined);
      expect(mocks.runReport).toHaveBeenCalled();
      mocks.runReport.mockClear();
    }
    expect(mocks.getTotal).not.toHaveBeenCalled();
  });
});
