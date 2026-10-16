import { beforeEach, describe, expect, it, vi } from "vitest";
import { CostLedgerRepository } from "./CostLedgerRepository";
import { getProjectCosts } from "./ProjectCostsService";
import { costPerSerpAtDepth } from "@/shared/rank-tracking";

const { testDb } = await vi.hoisted(async () => {
  const { createMetricsHistoryTestDb } =
    await import("@/server/features/metrics-history/metricsHistoryTestDb");
  return { testDb: await createMetricsHistoryTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const P = "project";
const ledger = (
  occurredAt: string,
  costUsd: number,
  extra: Partial<Parameters<typeof CostLedgerRepository.record>[0]> = {},
) => ({
  projectId: P,
  organizationId: "organization",
  occurredAt,
  source: "rank_check" as const,
  provider: "dataforseo" as const,
  operation: "Rank check",
  costUsd,
  status: "ok" as const,
  ...extra,
});

beforeEach(async () => {
  await testDb.seedProject();
  await testDb.client.executeMultiple(`
    INSERT INTO rank_tracking_configs (id, project_id, domain, serp_depth, devices)
      VALUES ('config', 'project', 'openseo.so', 30, 'both');
    INSERT INTO rank_check_runs (id, config_id, project_id, status, keywords_total, keywords_checked, started_at)
      VALUES ('run-actual', 'config', 'project', 'completed', 4, 4, '2026-10-10 12:00:00'),
             ('run-old', 'config', 'project', 'completed', 2, 2, '2026-10-05 12:00:00');
    INSERT INTO rank_snapshots (run_id, tracking_keyword_id, keyword, device, position)
      VALUES ('run-actual', 'k1', 'boat', 'desktop', 3),
             ('run-actual', 'k1', 'boat', 'mobile', NULL),
             ('run-old', 'k1', 'boat', 'desktop', 5),
             ('run-old', 'k1', 'boat', 'mobile', 9),
             ('run-old', 'k2', 'site:example.com', 'desktop', NULL);
    INSERT INTO audits (id, project_id, started_by_user_id, start_url, status, config, pages_crawled, started_at)
      VALUES ('audit-1', 'project', 'u', 'https://openseo.so', 'running', '{"maxPages":50,"lighthouseStrategy":"auto"}', 12, '2026-10-12 08:00:00');
  `);
});

describe("getProjectCosts", () => {
  it("prices runs from the ledger and estimates pre-ledger runs", async () => {
    await CostLedgerRepository.recordMany([
      ledger("2026-10-10T12:01:00.000Z", 0.3, {
        runId: "run-actual",
        runKind: "rank_check_run",
      }),
      ledger("2026-10-10T12:02:00.000Z", 0.1, {
        runId: "run-actual",
        runKind: "rank_check_run",
      }),
      ledger("2026-10-12T08:05:00.000Z", 0.05, {
        runId: "audit-1",
        runKind: "audit",
        source: "site_audit",
      }),
      ledger("2026-10-11T09:00:00.000Z", 0.2, {
        source: "keyword_research",
        operation: "Keyword research: boat",
        requestSummary: '{"seed":"boat"}',
        resultCount: 40,
      }),
    ]);

    const result = await getProjectCosts({
      projectId: P,
      from: "2026-10-01",
      to: "2026-10-15",
    });

    const byId = new Map(result.runs.map((run) => [run.runId, run]));
    expect(byId.get("run-actual")).toMatchObject({
      runKind: "rank_check_run",
      costStatus: "actual",
      costUsd: 0.4,
      requested: "4 keywords × 2 devices, top 30",
      got: "2 checked, 1 found in top 30",
    });
    // 3 snapshots, one of them a 5x advanced-operator keyword.
    const perSerp = costPerSerpAtDepth(30, "live");
    expect(byId.get("run-old")).toMatchObject({
      costStatus: "estimated",
      costUsd: Math.round((2 * perSerp + 5 * perSerp) * 1e6) / 1e6,
    });
    expect(byId.get("audit-1")).toMatchObject({
      runKind: "audit",
      costStatus: "partial",
      costUsd: 0.05,
      got: "12 pages, 0 issues",
    });
    expect(result.runs.map((run) => run.runId)).toEqual([
      "audit-1",
      "run-actual",
      "run-old",
    ]);

    expect(result.totals.usd).toBe(0.65);
    expect(result.totals.bySource).toEqual({
      rank_check: 0.4,
      site_audit: 0.05,
      keyword_research: 0.2,
    });
    expect(result.totals.byProvider).toEqual({ dataforseo: 0.65 });
    expect(result.days.map((day) => [day.date, day.usd])).toEqual([
      ["2026-10-10", 0.4],
      ["2026-10-11", 0.2],
      ["2026-10-12", 0.05],
    ]);
    expect(result.lookups).toMatchObject([
      {
        occurredAt: "2026-10-11T09:00:00.000Z",
        source: "keyword_research",
        operation: "Keyword research: boat",
        requestSummary: '{"seed":"boat"}',
        resultCount: 40,
        costUsd: 0.2,
        status: "ok",
      },
    ]);
    expect(result.ledgerSince).toBe("2026-10-10");
    expect(result.window).toEqual({ from: "2026-10-01", to: "2026-10-15" });
  });

  it("reports an empty ledger", async () => {
    const result = await getProjectCosts({
      projectId: P,
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(result.ledgerSince).toBeNull();
    expect(result.totals.usd).toBe(0);
    expect(result.lookups).toEqual([]);
    expect(result.runs.every((run) => run.costStatus === "estimated")).toBe(
      true,
    );
  });
});
