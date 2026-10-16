import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("@/server/lib/r2-cache", () => ({
  buildCacheKey: vi.fn(async () => "key"),
  getCached: mocks.getCached,
  setCached: mocks.setCached,
}));
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: { claim: mocks.claim, finish: mocks.finish },
  }),
);

import { DashboardCacheService } from "./DashboardCacheService";

const base = {
  namespace: "test",
  organizationId: "org",
  params: {},
  schema: z.array(z.string()),
  maxAgeMs: 1000,
};

describe("readThrough cacheOnly", () => {
  const load = vi.fn(async () => ["live"]);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claim.mockResolvedValue("token");
  });

  it("returns the empty value on a miss and never loads or claims", async () => {
    mocks.getCached.mockResolvedValue(null);
    const result = await DashboardCacheService.readThrough({
      ...base,
      load,
      cacheOnly: { empty: [] },
    });
    expect(result.value).toEqual([]);
    expect(load).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.setCached).not.toHaveBeenCalled();
  });

  it("serves an expired cache entry as stale without loading", async () => {
    mocks.getCached.mockResolvedValue({
      value: ["old"],
      fetchedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const result = await DashboardCacheService.readThrough({
      ...base,
      load,
      cacheOnly: { empty: [] },
    });
    expect(result).toMatchObject({ value: ["old"], stale: true });
    expect(load).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("still loads on a miss when cacheOnly is not set", async () => {
    mocks.getCached.mockResolvedValue(null);
    const result = await DashboardCacheService.readThrough({ ...base, load });
    expect(result.value).toEqual(["live"]);
    expect(load).toHaveBeenCalledOnce();
  });
});
