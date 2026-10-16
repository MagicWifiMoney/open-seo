import { sort } from "remeda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetricsHistoryRepository as repo } from "./MetricsHistoryRepository";
import {
  StoredMetricsInputError,
  StoredMetricsService as svc,
} from "./StoredMetricsService";

const { testDb } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } = await import("./metricsHistoryTestDb");
  return { testDb: await createMetricsHistoryTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const P = "project";
const metrics = (clicks: number) => ({
  clicks,
  impressions: clicks * 10,
  ctr: 0.1,
  position: 3.5,
  finalized: true,
});
const site = (date: string, device: string, clicks: number) => ({
  date,
  device,
  ...metrics(clicks),
});

beforeEach(async () => {
  await testDb.seedProject();
});

describe("getStatus", () => {
  it("reports null state and empty coverage for a new project", async () => {
    const status = await svc.getStatus(P);
    expect(status.gsc.state).toBeNull();
    expect(status.ga4.state).toBeNull();
    expect(status.gsc.coverage).toMatchObject({
      minDate: null,
      maxDate: null,
      maxFinalizedDate: null,
      rowCounts: { site: 0, page: 0, queryPage: 0 },
    });
    expect(status.ga4.coverage.rowCounts.total).toBe(0);
  });

  it("includes ingest state and coverage once data exists", async () => {
    await repo.ensureState(P, "gsc");
    await repo.upsertGscSite(P, [site("2026-01-01", "", 5)]);
    const status = await svc.getStatus(P);
    expect(status.gsc.state).toMatchObject({
      claimed_at: null,
      last_error: null,
      last_success_at: null,
      backfill_done: false,
    });
    expect(status.gsc.coverage).toMatchObject({
      minDate: "2026-01-01",
      maxFinalizedDate: "2026-01-01",
    });
  });
});

describe("getGscDaily", () => {
  const range = { startDate: "2026-01-01", endDate: "2026-01-31" };

  it("filters site and device grains", async () => {
    await repo.upsertGscSite(P, [
      site("2026-01-01", "", 10),
      site("2026-01-01", "MOBILE", 6),
      site("2026-01-01", "DESKTOP", 4),
    ]);
    const siteRows = await svc.getGscDaily(P, { ...range, grain: "site" });
    expect(siteRows).toHaveLength(1);
    const deviceRows = await svc.getGscDaily(P, { ...range, grain: "device" });
    expect(
      sort(
        deviceRows.map((r) => ("device" in r ? r.device : "")),
        (a, b) => a.localeCompare(b),
      ),
    ).toEqual(["DESKTOP", "MOBILE"]);
  });

  it("clamps limit to the max and defaults to 250", async () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({
      date: "2026-01-01",
      page: `/p${i}`,
      ...metrics(i),
    }));
    await repo.upsertGscPage(P, rows);
    expect(await svc.getGscDaily(P, { ...range, grain: "page" })).toHaveLength(
      250,
    );
    expect(
      await svc.getGscDaily(P, { ...range, grain: "page", limit: 5 }),
    ).toHaveLength(5);
    expect(
      await svc.getGscDaily(P, { ...range, grain: "page", limit: 99_999 }),
    ).toHaveLength(300);
  });

  it("rejects bad dates, reversed ranges and bad limits", async () => {
    const run = (input: Parameters<typeof svc.getGscDaily>[1]) =>
      svc.getGscDaily(P, input);
    await expect(
      run({ startDate: "2026-1-1", endDate: "2026-01-02", grain: "site" }),
    ).rejects.toBeInstanceOf(StoredMetricsInputError);
    await expect(
      run({ startDate: "2026-02-30", endDate: "2026-03-02", grain: "site" }),
    ).rejects.toBeInstanceOf(StoredMetricsInputError);
    await expect(
      run({ startDate: "2026-02-02", endDate: "2026-02-01", grain: "site" }),
    ).rejects.toThrow("on or before");
    await expect(
      run({ ...range, grain: "page", limit: 0 }),
    ).rejects.toBeInstanceOf(StoredMetricsInputError);
  });
});

describe("getGa4Daily", () => {
  it("returns totals and caps non-total grains", async () => {
    await repo.upsertGa4Total(P, [
      {
        date: "2026-01-01",
        sessions: 3,
        activeUsers: 2,
        engagedSessions: 1,
        keyEvents: 0,
      },
    ]);
    const range = { startDate: "2026-01-01", endDate: "2026-01-31" };
    expect(await svc.getGa4Daily(P, { ...range, grain: "total" })).toHaveLength(
      1,
    );
    expect(
      await svc.getGa4Daily(P, { ...range, grain: "channel" }),
    ).toHaveLength(0);
    await expect(
      svc.getGa4Daily(P, { startDate: "x", endDate: "y", grain: "total" }),
    ).rejects.toBeInstanceOf(StoredMetricsInputError);
  });
});
