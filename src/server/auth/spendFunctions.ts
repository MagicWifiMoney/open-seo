// Single source of truth for everything the `client` role must not trigger.
// spendGate.test.ts executes the real source files against these lists, so a
// new spending handler that is not listed here (or listed but not gated) fails
// the build.

export const SPEND_NOT_ALLOWED_MESSAGE =
  "Your account cannot spend research credits yet. Ask the workspace owner to enable it.";

export const SPEND_NOT_ALLOWED_REASON = "SPEND_NOT_ALLOWED";

/** Server functions that call `requireSpend` at the top of the handler. */
export const SPEND_SERVER_FUNCTIONS: Record<string, string[]> = {
  "src/serverFunctions/keywords.ts": [
    "researchKeywords",
    "refreshSavedKeywordMetrics",
    "getSerpAnalysis",
  ],
  "src/serverFunctions/domain.ts": [
    "getDomainOverview",
    "getDomainKeywordSuggestions",
    "getDomainKeywordsPage",
    "getDomainPagesPage",
  ],
  "src/serverFunctions/backlinks.ts": [
    "getBacklinksOverview",
    "getBacklinksRows",
    "getBacklinksReferringDomains",
    "getBacklinksTopPages",
  ],
  "src/serverFunctions/rank-tracking.ts": [
    "updateRankTrackingConfig",
    "triggerRankCheck",
    "refreshTrackingKeywordMetrics",
  ],
  "src/serverFunctions/audit.ts": ["startAudit"],
  "src/serverFunctions/ai-visibility.ts": [
    "generateAiVisibilityPrompts",
    "researchAiVisibilityPrompts",
    "startAiResearchSetup",
    "runAiVisibilityCheck",
    "setAiVisibilitySchedule",
    "saveAiVisibilityTracker",
  ],
  "src/serverFunctions/ai-search.ts": ["lookupBrand", "explorePrompt"],
  "src/serverFunctions/projectWebsite.ts": [
    "researchProjectWebsite",
    "saveProjectWebsiteSetup",
  ],
  // Deliberately NOT gated: serp-locations.ts (searchSerpLocations,
  // prewarmSerpLocations) and the search_serp_locations MCP tool only read
  // DataForSEO's locations list through fetchSerpLocationsForCountry. That
  // endpoint is free (cost 0, no billing envelope) and cached in KV for 30
  // days, so clients can use the location picker.
};

/**
 * Server functions that stay open to clients but branch on `canSpend` so the
 * paid part is skipped: rank tracking persists without auto-check and reports
 * `spendSkipped: true`, project domain changes skip the first audit, and the
 * dashboard link cards read the cache only.
 */
export const SPEND_SPLIT_SERVER_FUNCTIONS: Record<string, string[]> = {
  "src/serverFunctions/rank-tracking.ts": [
    "createRankTrackingConfig",
    "addTrackingKeywords",
  ],
  "src/serverFunctions/projects.ts": ["updateProject"],
  "src/serverFunctions/dashboard.ts": [
    "getDashboardBacklinks",
    "getDashboardLinkActivity",
  ],
};

/** MCP tools registered with `spend: true`. */
export const SPEND_MCP_TOOLS = [
  "research_keywords",
  "get_keyword_metrics",
  "get_ranked_keywords",
  "find_serp_competitors",
  "get_serp_results",
  "get_local_serp_results",
  "search_local_businesses",
  "get_google_business_questions",
  "get_business_profile",
  "get_business_reviews",
  "get_business_updates",
  "get_local_rank_grid",
  "list_business_categories",
  "get_domain_overview",
  "get_domain_keyword_suggestions",
  "get_backlinks_overview",
  "get_backlinks_profile",
  "explore_prompt",
  "research_project_website",
  "run_site_audit",
  "run_rank_tracker",
  "create_rank_tracker",
  "add_rank_tracking_keywords",
  "generate_ai_visibility_prompts",
  "complete_ai_research_setup",
  "research_ai_visibility_prompts",
  "run_ai_visibility_check",
  "set_ai_visibility_schedule",
  "save_project_website_setup",
  "save_ai_visibility_tracker",
] as const;

/**
 * Handlers that reach a paid entry point through an import (the source scan
 * follows imports three levels deep, so it over-reports) but spend nothing
 * themselves. Key is `file:handler` (server functions) or `file:tool_name`
 * (MCP). Every entry needs a reason; spendScan.test.ts fails on stale entries.
 */
export const FREE_DESPITE_IMPORT: Record<string, string> = {
  ...Object.fromEntries(
    [
      "getAiResearchSetup",
      "listAiResearchKeywords",
      "getAiVisibilityTracker",
      "estimateAiVisibilityCost",
      "getAiVisibilityRun",
      "getAiVisibilityResults",
      "getAiVisibilitySources",
      "getAiVisibilityTrend",
      "getAiVisibilityAnswer",
      "exportAiVisibilityData",
    ].map((name) => [
      `src/serverFunctions/ai-visibility.ts:${name}`,
      "reads stored AI visibility state or a cost estimate; starts no run",
    ]),
  ),
  ...Object.fromEntries(
    [
      "getAuditStatus",
      "getAuditResults",
      "getAuditHistory",
      "getCrawlProgress",
      "deleteAudit",
    ].map((name) => [
      `src/serverFunctions/audit.ts:${name}`,
      "reads or deletes stored audit rows; starts no crawl",
    ]),
  ),
  ...Object.fromEntries(
    [
      "saveKeywords",
      "getSavedKeywords",
      "exportSavedKeywords",
      "updateSavedKeywordTags",
      "updateSavedKeywordTag",
      "deleteSavedKeywordTag",
      "removeSavedKeywords",
    ].map((name) => [
      `src/serverFunctions/keywords.ts:${name}`,
      "saved keyword bookkeeping only; metrics refresh is a separate gated call",
    ]),
  ),
  ...Object.fromEntries(
    ["getLatestRankRun", "estimateRankCheckCost", "removeTrackingKeywords"].map(
      (name) => [
        `src/serverFunctions/rank-tracking.ts:${name}`,
        "reads stored runs, estimates cost, or removes rows; no provider call",
      ],
    ),
  ),
  "src/serverFunctions/dashboard.ts:getDashboardKeywords":
    "stored rows or Google Search Console, which is not metered",
  "src/serverFunctions/dashboard.ts:getDashboardEmergingQueries":
    "stored rows or Google Search Console, which is not metered",
  "src/serverFunctions/dataforseo-spend.ts:getDataforseoSpend":
    "DataForSEO account snapshot, a free non-billable endpoint",
  "src/serverFunctions/projects.ts:createProject":
    "requires project:create, which the client role lacks",
  "src/serverFunctions/serp-locations.ts:searchSerpLocations":
    "DataForSEO locations list: free (cost 0) and cached in KV for 30 days",
  "src/serverFunctions/serp-locations.ts:prewarmSerpLocations":
    "DataForSEO locations list: free (cost 0) and cached in KV for 30 days",
  ...Object.fromEntries(
    [
      "get_ai_visibility_tracker",
      "estimate_ai_visibility_cost",
      "get_ai_visibility_run",
      "get_ai_visibility_results",
      "get_ai_visibility_answer",
      "get_ai_visibility_sources",
      "get_ai_visibility_trend",
      "export_ai_visibility_data",
    ].map((name) => [
      `src/server/mcp/tools/ai-visibility-tools.ts:${name}`,
      "reads stored AI visibility state or a cost estimate; starts no run",
    ]),
  ),
  "src/server/mcp/tools/estimate-rank-tracker-cost.ts:estimate_rank_tracker_cost":
    "cost estimate only",
  "src/server/mcp/tools/get-rank-tracker.ts:get_rank_tracker":
    "reads stored rank tracking state",
  "src/server/mcp/tools/list-saved-keywords.ts:list_saved_keywords":
    "reads saved keywords",
  "src/server/mcp/tools/remove-rank-tracking-keywords.ts:remove_rank_tracking_keywords":
    "removes rows; no provider call",
  "src/server/mcp/tools/remove-saved-keywords.ts:remove_saved_keywords":
    "removes saved keyword rows",
  "src/server/mcp/tools/save-keywords.ts:save_keywords":
    "saved keyword bookkeeping only",
  "src/server/mcp/tools/search-serp-locations.ts:search_serp_locations":
    "DataForSEO locations list: free (cost 0) and cached in KV for 30 days",
  "src/server/mcp/tools/site-audit-cleanup-tools.ts:list_site_audits":
    "reads stored audits",
  "src/server/mcp/tools/site-audit-cleanup-tools.ts:delete_site_audit":
    "deletes stored audit rows",
  "src/server/mcp/tools/site-audit-tools.ts:get_audit_status":
    "reads stored audit state",
  "src/server/mcp/tools/site-audit-tools.ts:get_audit_issues":
    "reads stored audit results",
  "src/server/mcp/tools/site-audit-tools.ts:get_audit_pages":
    "reads stored audit results",
};
