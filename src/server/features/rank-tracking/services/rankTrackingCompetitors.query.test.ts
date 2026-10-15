import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { getCompetitorMatrix } from "./rankTrackingCompetitors";
import { RankTrackingRepository } from "../repositories/RankTrackingRepository";

const runtime = vi.hoisted(() => ({
  env: { DATABASE_PROVIDER: "d1" },
  client: null as Client | null,
}));

vi.mock("cloudflare:workers", () => ({ env: runtime.env }));
vi.mock("@/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  runtime.client = createClient({ url: "file::memory:" });
  return { db: drizzle(runtime.client) };
});

// D1's batch API is not available in-process; run the same statements in order.
vi.mock("@/db/runBatch", async () => {
  const { db } = await import("@/db");
  return {
    DB_BATCH_SIZE: 100,
    executeInBatches: async <T>(
      items: T[],
      build: (tx: typeof db, item: T) => Promise<unknown>,
    ) => {
      for (const item of items) await build(db, item);
    },
  };
});

// Real SQLite so the recent-run selection and the joins run as SQL.
beforeAll(async () => {
  await runtime.client!.executeMultiple(`
    CREATE TABLE rank_tracking_keywords (
      id TEXT PRIMARY KEY, config_id TEXT, keyword TEXT, match_case INTEGER,
      search_volume INTEGER, keyword_difficulty INTEGER, cpc REAL,
      metrics_fetched_at TEXT, pinned_at TEXT, created_at TEXT
    );
    CREATE TABLE rank_check_runs (
      id TEXT PRIMARY KEY, config_id TEXT, project_id TEXT, status TEXT,
      keywords_total INTEGER, keywords_checked INTEGER, is_subset_run INTEGER,
      error_message TEXT, started_at TEXT, completed_at TEXT
    );
    CREATE TABLE rank_snapshots (
      id INTEGER PRIMARY KEY, run_id TEXT, tracking_keyword_id TEXT, keyword TEXT,
      device TEXT, position INTEGER, url TEXT, serp_features TEXT, checked_at TEXT
    );
    CREATE TABLE rank_competitor_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, tracking_keyword_id TEXT,
      device TEXT, competitor_domain TEXT, position INTEGER, url TEXT,
      checked_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX rcs_unique ON rank_competitor_snapshots
      (run_id, tracking_keyword_id, device, competitor_domain);
    CREATE TABLE project_competitors (
      id TEXT PRIMARY KEY, project_id TEXT, domain TEXT, name TEXT, notes TEXT,
      updated_at TEXT, updated_by TEXT
    );
    INSERT INTO rank_tracking_keywords (id, config_id, keyword)
      VALUES ('kw', 'config', 'plumber');
    INSERT INTO project_competitors (id, project_id, domain, updated_at, updated_by)
      VALUES ('c1', 'project', 'rival.com', 'x', 'user'),
             ('c2', 'project', 'removed-from-grid.com', 'x', 'user');
    INSERT INTO rank_check_runs (id, config_id, project_id, status, started_at)
      VALUES ('old', 'config', 'project', 'completed', '2026-10-01T00:00:00.000Z'),
             ('new', 'config', 'project', 'completed', '2026-10-08T00:00:00.000Z'),
             ('plain', 'config', 'project', 'completed', '2026-10-09T00:00:00.000Z');
    INSERT INTO rank_snapshots (run_id, tracking_keyword_id, keyword, device, position)
      VALUES ('old', 'kw', 'plumber', 'desktop', 9),
             ('new', 'kw', 'plumber', 'desktop', 5),
             ('plain', 'kw', 'plumber', 'desktop', 6);
    INSERT INTO rank_competitor_snapshots
      (run_id, tracking_keyword_id, device, competitor_domain, position, url)
      VALUES ('old', 'kw', 'desktop', 'rival.com', 3, NULL),
             ('new', 'kw', 'desktop', 'rival.com', 2, 'https://rival.com/p'),
             ('new', 'kw', 'mobile', 'rival.com', 40, NULL);
  `);
});

afterAll(() => {
  runtime.client!.close();
});

describe("competitor matrix", () => {
  it("returns the latest and previous run positions for the target and each saved competitor", async () => {
    const matrix = await getCompetitorMatrix({
      configId: "config",
      projectId: "project",
      device: "desktop",
    });

    // The run without competitor data is ignored, and a competitor with no
    // recorded rows (c2) stays out of the grid.
    expect(matrix.competitors).toEqual(["rival.com"]);
    expect(matrix.latestCheckedAt).toBe("2026-10-08T00:00:00.000Z");
    expect(matrix.rows).toEqual([
      {
        trackingKeywordId: "kw",
        keyword: "plumber",
        target: { position: 5, previousPosition: 9, url: null },
        competitorCells: {
          "rival.com": {
            position: 2,
            previousPosition: 3,
            url: "https://rival.com/p",
          },
        },
      },
    ]);
  });

  it("keeps a replayed insert idempotent", async () => {
    const row = {
      runId: "new",
      trackingKeywordId: "kw",
      device: "desktop" as const,
      competitorDomain: "rival.com",
      position: 99,
      url: null,
    };
    await RankTrackingRepository.insertCompetitorSnapshots([row]);

    const matrix = await getCompetitorMatrix({
      configId: "config",
      projectId: "project",
      device: "desktop",
    });
    expect(matrix.rows[0].competitorCells["rival.com"].position).toBe(2);
  });
});
