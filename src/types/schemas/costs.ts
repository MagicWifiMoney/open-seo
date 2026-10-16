// STUB: the server worker's real file replaces this on merge. Keep names identical.
export type CostSource =
  | "rank_check"
  | "ai_visibility"
  | "site_audit"
  | "keyword_research"
  | "serp"
  | "domain"
  | "backlinks"
  | "local_seo"
  | "ai_lookup"
  | "llm"
  | "rendering"
  | "other";

export type ProjectCostsResponse = {
  balanceUsd: number | null;
  window: { from: string; to: string };
  totals: {
    usd: number;
    byProvider: Record<string, number>;
    bySource: Record<string, number>;
  };
  days: Array<{ date: string; usd: number; bySource: Record<string, number> }>;
  runs: Array<{
    runId: string;
    runKind: "rank_check_run" | "ai_run" | "audit";
    source: CostSource;
    label: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    requested: string;
    got: string;
    costUsd: number;
    costStatus: "actual" | "estimated" | "partial";
  }>;
  lookups: Array<{
    id: number;
    occurredAt: string;
    source: CostSource;
    operation: string;
    requestSummary: string | null;
    resultCount: number | null;
    costUsd: number;
    status: "ok" | "failed_charged" | "estimated";
  }>;
  ledgerSince: string | null;
};
