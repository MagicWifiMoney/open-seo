import {
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// Keep these definitions structurally identical to ../cost-ledger.schema.ts.
export const costLedger = pgTable(
  "cost_ledger",
  {
    id: serial("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id"),
    occurredAt: text("occurred_at").notNull(),
    source: text("source", {
      enum: [
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
      ],
    }).notNull(),
    runId: text("run_id"),
    runKind: text("run_kind", {
      enum: ["rank_check_run", "ai_run", "audit"],
    }),
    provider: text("provider", {
      enum: ["dataforseo", "openrouter", "cloudflare"],
    }).notNull(),
    creditFeature: text("credit_feature"),
    apiPath: text("api_path"),
    operation: text("operation").notNull(),
    requestSummary: text("request_summary"),
    resultCount: integer("result_count"),
    costUsd: real("cost_usd").notNull(),
    status: text("status", {
      enum: ["ok", "failed_charged", "estimated"],
    }).notNull(),
  },
  (table) => [
    index("cost_ledger_project_time_idx").on(table.projectId, table.occurredAt),
    index("cost_ledger_run_idx").on(table.runId),
  ],
);
