import { CostLedgerRepository } from "@/server/features/costs/CostLedgerRepository";
import type { CostLedgerEntry } from "@/server/features/costs/CostLedgerRepository";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { DataforseoApiCallCost } from "@/server/lib/dataforseo/envelope";
import {
  mapDataforseoPathToCreditFeature,
  type CreditFeature,
} from "@/shared/billing-credit-features";
import type {
  CostRunKind,
  CostSource,
  CostStatus,
} from "@/types/schemas/costs";

/**
 * Attribution for the cost ledger, passed to createDataforseoClient. Everything
 * is optional: without it the source comes from the endpoint's credit feature
 * and the operation is the API path. Never put secrets in requestSummary.
 */
export type CostLedgerContext = {
  source?: CostSource;
  runId?: string;
  runKind?: CostRunKind;
  operation?: string;
  requestSummary?: unknown;
};

const SUMMARY_MAX = 500;

export function summarizeRequest(summary: unknown): string | null {
  if (summary == null) return null;
  try {
    const json =
      typeof summary === "string" ? summary : JSON.stringify(summary);
    if (json.length <= SUMMARY_MAX) return json;
    return JSON.stringify({ truncated: json.slice(0, SUMMARY_MAX - 20) });
  } catch {
    return null;
  }
}

export function sourceForCall(
  path: readonly string[],
  feature: CreditFeature,
): CostSource {
  switch (feature) {
    case "site_audit":
      return "site_audit";
    case "backlinks":
      return "backlinks";
    case "domain_overview":
      return "domain";
    case "local_seo":
      return "local_seo";
    case "ai_citations":
    case "ai_prompt_responses":
      return "ai_lookup";
    case "rank_tracking":
      return "rank_check";
    case "agent":
      return "llm";
    case "keyword_research": {
      const module = path[0] === "v3" ? path[1] : path[0];
      return module === "serp" ? "serp" : "keyword_research";
    }
  }
}

/** One settled call, or null when there is nothing to record. */
export function buildLedgerEntry(input: {
  customer: BillingCustomerContext;
  ctx?: CostLedgerContext;
  creditFeature?: CreditFeature;
  billing: DataforseoApiCallCost;
  status: CostStatus;
}): CostLedgerEntry | null {
  const { customer, ctx, billing, status } = input;
  // A ledger row needs a project to attach to, and free calls add only noise.
  if (!customer.projectId || !(billing.costUsd > 0)) return null;
  const feature =
    input.creditFeature ?? mapDataforseoPathToCreditFeature(billing.path);
  return {
    projectId: customer.projectId,
    organizationId: customer.organizationId,
    userId: customer.userId,
    source: ctx?.source ?? sourceForCall(billing.path, feature),
    runId: ctx?.runId ?? null,
    runKind: ctx?.runKind ?? null,
    provider: "dataforseo",
    creditFeature: feature,
    apiPath: billing.path.join("/"),
    operation: ctx?.operation ?? billing.path.join("/"),
    requestSummary: summarizeRequest(ctx?.requestSummary),
    resultCount: billing.resultCount ?? null,
    costUsd: billing.costUsd,
    status,
  };
}

/** Never throws; the returned promise is safe to await or waitUntil. */
export function recordLedgerEntries(entries: Array<CostLedgerEntry | null>) {
  return CostLedgerRepository.recordMany(
    entries.filter((entry) => entry !== null),
  );
}
