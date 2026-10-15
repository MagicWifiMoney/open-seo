import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";

// One referring-domain snapshot per project per Central Time day. A second
// check on the same day updates the row.
export const offsiteAuthoritySnapshots = sqliteTable(
  "offsite_authority_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    // YYYY-MM-DD in America/Chicago.
    snapshotDate: text("snapshot_date").notNull(),
    referringDomains: integer("referring_domains"),
    backlinks: integer("backlinks"),
    source: text("source").notNull().default("dataforseo_backlinks"),
    checkedAt: text("checked_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("offsite_snapshots_project_date_idx").on(
      table.projectId,
      table.snapshotDate,
    ),
  ],
);

// Manual log of link-building asks (who was asked, how it went).
export const offsiteOutreachLog = sqliteTable(
  "offsite_outreach_log",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    targetName: text("target_name").notNull(),
    targetUrl: text("target_url"),
    channel: text("channel", {
      enum: [
        "attorney",
        "realtor",
        "directory",
        "senior_living",
        "press",
        "paid_placement",
        "other",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["planned", "asked", "replied", "link_live", "declined"],
    }).notNull(),
    // YYYY-MM-DD
    askedOn: text("asked_on"),
    linkedPageUrl: text("linked_page_url"),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("offsite_outreach_project_idx").on(table.projectId)],
);
