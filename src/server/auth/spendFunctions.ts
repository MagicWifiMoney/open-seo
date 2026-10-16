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
  ],
  "src/serverFunctions/ai-search.ts": ["lookupBrand", "explorePrompt"],
  "src/serverFunctions/projectWebsite.ts": ["researchProjectWebsite"],
  "src/serverFunctions/serp-locations.ts": [
    "prewarmSerpLocations",
    "searchSerpLocations",
  ],
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
  "search_serp_locations",
] as const;
