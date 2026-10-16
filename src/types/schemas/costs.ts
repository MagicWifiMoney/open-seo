import { z } from "zod";

// Shared by the cost ledger, the listProjectCosts server function and the
// Costs tab (no server imports).

export const COST_SOURCES = [
  "rank_check",
  "ai_visibility",
  "site_audit",
  "keyword_research",
  "serp",
  "domain",
  "backlinks",
  "local_seo",
  "ai_lookup",
  "llm",
  "rendering",
  "other",
] as const;
export const COST_RUN_KINDS = ["rank_check_run", "ai_run", "audit"] as const;
export const COST_PROVIDERS = [
  "dataforseo",
  "openrouter",
  "cloudflare",
] as const;
export const COST_STATUSES = ["ok", "failed_charged", "estimated"] as const;

export type CostSource = (typeof COST_SOURCES)[number];
export type CostRunKind = (typeof COST_RUN_KINDS)[number];
export type CostProvider = (typeof COST_PROVIDERS)[number];
export type CostStatus = (typeof COST_STATUSES)[number];

export const listProjectCostsInputSchema = z.object({
  projectId: z.string().uuid(),
  /** YYYY-MM-DD, inclusive. Defaults to 30 days before `to`. */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** YYYY-MM-DD, inclusive. Defaults to today (UTC). */
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type ListProjectCostsInput = z.infer<typeof listProjectCostsInputSchema>;

export type ProjectCostsRun = {
  runId: string;
  runKind: CostRunKind;
  source: CostSource;
  label: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  /** e.g. "210 keywords × 2 devices, top 30" */
  requested: string;
  /** e.g. "407 checked, 312 found in top 30" */
  got: string;
  costUsd: number;
  costStatus: "actual" | "estimated" | "partial";
};

export type ProjectCostsLookup = {
  id: number;
  occurredAt: string;
  source: CostSource;
  operation: string;
  requestSummary: string | null;
  resultCount: number | null;
  costUsd: number;
  status: CostStatus;
};

export type ProjectCostsResponse = {
  /** DataForSEO account balance (free appendix call); null if unavailable. */
  balanceUsd: number | null;
  window: { from: string; to: string };
  totals: {
    usd: number;
    byProvider: Record<string, number>;
    bySource: Record<string, number>;
  };
  days: Array<{
    date: string;
    usd: number;
    bySource: Record<string, number>;
  }>;
  runs: ProjectCostsRun[];
  /** Non-run rows, newest first, max 500. */
  lookups: ProjectCostsLookup[];
  /** Earliest ledger row date, or null when nothing is recorded yet. */
  ledgerSince: string | null;
};
