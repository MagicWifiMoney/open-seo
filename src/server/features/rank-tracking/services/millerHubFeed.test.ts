import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleMillerHubFeed } from "./millerHubFeed";

interface FeedSnapshot {
  asOf: string;
  ranks: Array<{
    status: "ranked" | "out" | "unchecked";
    mobileCheckedAt: string | null;
    rankingUrl: string | null;
  }>;
  tracking: { checked: number; unchecked: number };
  visibility: {
    tracked: number;
    ranked: number;
    top10: number;
    score: null;
    estimatedClicks: null;
  };
  moversUp: Array<{ keyword: string; from: number | null; to: number | null }>;
}

const mocks = vi.hoisted(() => ({
  getConfigById: vi.fn(),
  getLatestSnapshotsForKeywords: vi.fn(),
  getLatestRunForConfig: vi.fn(),
  getLatestResults: vi.fn(),
}));
vi.mock("../repositories/RankTrackingRepository", () => ({
  RankTrackingRepository: mocks,
}));
vi.mock("./rankTrackingResults", () => ({
  getLatestResults: mocks.getLatestResults,
}));
const configId = "dd63719c-2cea-460e-ba5a-a369c772fba4";
const projectId = "a3a7dde6-d78e-4912-bb18-d681a725392f";
const env = {
  AUTH_MODE: "cloudflare_access" as const,
  MILLER_HUB_FEED_ENABLED: "true",
  MILLER_HUB_TRACKER_ID: configId,
};
const origin = "https://open-seo-miller.magicwifimoney.workers.dev";
const request = (query = "", init?: RequestInit) =>
  new Request(`${origin}/api/public/miller-scoreboard${query}`, init);
const config = {
  id: configId,
  projectId,
  domain: "millerestatesolutions.com",
  devices: "both",
  locationName: "Minneapolis-St. Paul, MN, United States",
  serpDepth: 40,
  scheduleInterval: "weekly",
};
const row = { trackingKeywordId: "keyword-one", keyword: "estate sales mn" };
const saved = {
  trackingKeywordId: row.trackingKeywordId,
  device: "desktop",
  checkedAt: "2026-10-15 18:09:14",
  position: 4,
  url: "https://millerestatesolutions.com/sales?private=token#secret",
};

beforeEach(() => {
  mocks.getConfigById.mockResolvedValue(config);
  mocks.getLatestResults.mockResolvedValue({ rows: [row] });
  mocks.getLatestSnapshotsForKeywords.mockResolvedValue([saved]);
  mocks.getLatestRunForConfig.mockResolvedValue({ status: "completed" });
});

describe("Miller read-only public feed", () => {
  it.each([
    { ...env, MILLER_HUB_FEED_ENABLED: undefined },
    { ...env, MILLER_HUB_FEED_ENABLED: "false" },
    { ...env, AUTH_MODE: "hosted" as const },
    { ...env, AUTH_MODE: "local_noauth" as const },
  ])("fails closed before database access: %j", async (settings) => {
    expect((await handleMillerHubFeed(request(), settings)).status).toBe(404);
    expect(mocks.getConfigById).not.toHaveBeenCalled();
  });
  it("rejects another host even with forwarded host headers", async () => {
    const req = new Request(
      "https://other.workers.dev/api/public/miller-scoreboard",
      { headers: { "x-forwarded-host": new URL(origin).host } },
    );
    expect((await handleMillerHubFeed(req, env)).status).toBe(404);
    expect(mocks.getConfigById).not.toHaveBeenCalled();
  });
  it("rejects writes and caller-selected scope without database access", async () => {
    expect(
      (await handleMillerHubFeed(request("", { method: "POST" }), env)).status,
    ).toBe(405);
    for (const query of [
      "?projectId=other",
      "?history=2",
      "?history=1&history=1",
      "?tool=run",
    ])
      expect((await handleMillerHubFeed(request(query), env)).status).toBe(400);
    expect(mocks.getConfigById).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...config, projectId: "foreign" },
    { ...config, domain: "other.com" },
  ])(
    "refuses foreign or missing configs before config-only reads",
    async (value) => {
      mocks.getConfigById.mockResolvedValue(value);
      expect((await handleMillerHubFeed(request(), env)).status).toBe(503);
      expect(mocks.getConfigById).toHaveBeenCalledWith({ configId, projectId });
      expect(mocks.getLatestResults).not.toHaveBeenCalled();
    },
  );
  it("publishes only saved ranks and individual device dates without private data", async () => {
    mocks.getLatestResults.mockResolvedValue({
      rows: [
        {
          ...row,
          userId: "private",
          cpc: 123,
          desktop: { previousPosition: 10 },
        },
      ],
      run: { errorMessage: "provider secret" },
    });
    const response = await handleMillerHubFeed(request(), env);
    const body = (await response.json()) as FeedSnapshot;
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300",
    );
    expect(body.asOf).toBe("2026-10-15T18:09:14.000Z");
    expect(body.ranks[0]).toMatchObject({
      position: 4,
      previousPosition: null,
      desktopStatus: "ranked",
      mobileStatus: "unchecked",
      desktopCheckedAt: body.asOf,
      mobileCheckedAt: null,
      rankingUrl: "https://millerestatesolutions.com/sales",
    });
    expect(body.tracking).toMatchObject({ checked: 0, unchecked: 1 });
    expect(body.visibility).toMatchObject({
      tracked: 1,
      ranked: 1,
      top10: 1,
      score: null,
      estimatedClicks: null,
    });
    expect(JSON.stringify(body)).not.toMatch(
      /private|provider secret|projectId|trackingKeywordId|cpc|errorMessage/,
    );
  });
  it("distinguishes checked absent ranks from unexamined devices", async () => {
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      { ...saved, position: null },
    ]);
    const body = (await (
      await handleMillerHubFeed(request(), env)
    ).json()) as FeedSnapshot;
    expect(body.ranks[0]).toMatchObject({
      status: "unchecked",
      desktopStatus: "out",
      mobileStatus: "unchecked",
    });
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      { ...saved, position: null },
      { ...saved, device: "mobile", position: null },
    ]);
    const checked = (await (
      await handleMillerHubFeed(request(), env)
    ).json()) as FeedSnapshot;
    expect(checked.ranks[0].status).toBe("out");
    expect(checked.tracking).toMatchObject({ checked: 1, unchecked: 0 });
  });
  it("keeps mixed saved dates and flags a newer failed run as stale", async () => {
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      saved,
      {
        ...saved,
        device: "mobile",
        position: 2,
        checkedAt: "2026-10-14T12:00:00Z",
      },
    ]);
    mocks.getLatestRunForConfig.mockResolvedValue({
      status: "failed",
      completedAt: "2026-10-16T12:00:00Z",
      errorMessage: "private provider failure",
    });
    const body = (await (
      await handleMillerHubFeed(request("?history=1"), env)
    ).json()) as { pulls: FeedSnapshot[] };
    expect(body.pulls).toHaveLength(1);
    expect(body.pulls[0]).toMatchObject({
      stale: true,
      asOf: "2026-10-15T18:09:14.000Z",
    });
    expect(body.pulls[0].ranks[0].mobileCheckedAt).toBe(
      "2026-10-14T12:00:00.000Z",
    );
    expect(body.pulls[0].moversUp).toEqual([]);
  });
  it.each([
    "https://other.com/path",
    "http://millerestatesolutions.com/",
    "https://user:pass@millerestatesolutions.com/",
  ])("removes unsafe ranking URLs: %s", async (url) => {
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([{ ...saved, url }]);
    const body = (await (
      await handleMillerHubFeed(request(), env)
    ).json()) as FeedSnapshot;
    expect(body.ranks[0].rankingUrl).toBeNull();
  });
  it("rejects future source dates and supports native saved Date values", async () => {
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      { ...saved, checkedAt: new Date(Date.now() + 600_000) },
    ]);
    const response = await handleMillerHubFeed(request(), env);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "invalid_saved_snapshots",
    });
    mocks.getLatestSnapshotsForKeywords.mockResolvedValue([
      { ...saved, checkedAt: new Date("2026-10-15T18:09:14Z") },
    ]);
    expect((await handleMillerHubFeed(request(), env)).status).toBe(200);
  });
  it("rejects duplicate or undated snapshots, empty trackers and oversized output", async () => {
    for (const values of [
      [saved, saved],
      [{ ...saved, checkedAt: "broken" }],
      [],
    ]) {
      mocks.getLatestSnapshotsForKeywords.mockResolvedValue(values);
      const response = await handleMillerHubFeed(request(), env);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    mocks.getLatestResults.mockResolvedValue({ rows: Array(1001).fill(row) });
    expect((await handleMillerHubFeed(request(), env)).status).toBe(503);
    mocks.getLatestResults.mockResolvedValue({ rows: [] });
    expect((await handleMillerHubFeed(request(), env)).status).toBe(503);
  });
});
