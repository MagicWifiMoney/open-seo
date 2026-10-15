import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestResults } from "./rankTrackingResults";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

const mocks = vi.hoisted(() => ({
  getConfigById: vi.fn(),
  getKeywordsForConfig: vi.fn(),
  getLatestSnapshotsForKeywords: vi.fn(),
  getSnapshotsBeforeDate: vi.fn(),
  getLatestRunForConfig: vi.fn(),
  getEarliestSnapshotsForKeywords: vi.fn(),
}));

vi.mock(
  "@/server/features/rank-tracking/repositories/RankTrackingRepository",
  () => ({ RankTrackingRepository: mocks }),
);

describe("getLatestResults", () => {
  beforeEach(() => {
    mocks.getConfigById.mockResolvedValue({ id: "config_1" });
    mocks.getKeywordsForConfig.mockResolvedValue([]);
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([]);
    mocks.getSnapshotsBeforeDate.mockResolvedValue([]);
    mocks.getEarliestSnapshotsForKeywords.mockResolvedValue([]);
  });

  it("keeps snapshot freshness when a newer run fails before writing snapshots", async () => {
    mocks.getKeywordsForConfig.mockResolvedValue([
      {
        id: "kw_1",
        keyword: "open seo",
        searchVolume: 100,
        keywordDifficulty: 10,
        cpc: 1,
      },
    ]);
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      {
        trackingKeywordId: "kw_1",
        device: "desktop",
        runId: "run_1",
        checkedAt: "2026-08-01 10:00:00",
        position: 3,
        url: "https://example.com/",
        serpFeatures: null,
      },
    ]);
    mocks.getLatestRunForConfig.mockResolvedValue({
      id: "run_2",
      status: "failed",
      errorMessage: "Provider request timed out",
    });

    await expect(
      getLatestResults("config_1", "project_1"),
    ).resolves.toMatchObject({
      run: {
        id: "run_2",
        lastCheckedAt: "2026-08-01 10:00:00",
        status: "failed",
        errorMessage: "Provider request timed out",
      },
    });
  });

  it("marks hasCheck only for keywords with a snapshot", async () => {
    mocks.getKeywordsForConfig.mockResolvedValue([
      {
        id: "kw_1",
        keyword: "a",
        searchVolume: 1,
        keywordDifficulty: 1,
        cpc: 1,
      },
      {
        id: "kw_2",
        keyword: "b",
        searchVolume: 1,
        keywordDifficulty: 1,
        cpc: 1,
      },
    ]);
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      {
        trackingKeywordId: "kw_1",
        device: "desktop",
        runId: "run_1",
        checkedAt: "2026-08-01 10:00:00",
        position: null,
        url: null,
        serpFeatures: null,
      },
    ]);
    mocks.getLatestRunForConfig.mockResolvedValue(null);
    const result = await getLatestResults("config_1", "project_1");
    const byId = new Map(result.rows.map((r) => [r.trackingKeywordId, r]));
    expect(byId.get("kw_1")?.desktop.hasCheck).toBe(true);
    expect(byId.get("kw_1")?.mobile.hasCheck).toBe(false);
    expect(byId.get("kw_2")?.desktop.hasCheck).toBe(false);
  });
});
