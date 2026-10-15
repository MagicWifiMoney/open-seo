import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Keep these definitions structurally identical to ../offsite.schema.ts.
export const offsiteAuthoritySnapshots = pgTable(
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
    snapshotDate: text("snapshot_date").notNull(),
    referringDomains: integer("referring_domains"),
    backlinks: integer("backlinks"),
    source: text("source").notNull().default("dataforseo_backlinks"),
    checkedAt: text("checked_at").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("offsite_snapshots_project_date_idx").on(
      table.projectId,
      table.snapshotDate,
    ),
  ],
);

export const offsiteOutreachLog = pgTable(
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
    askedOn: text("asked_on"),
    linkedPageUrl: text("linked_page_url"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [index("offsite_outreach_project_idx").on(table.projectId)],
);
