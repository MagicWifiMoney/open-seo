import { z } from "zod";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import {
  StoredMetricsInputError,
  StoredMetricsService,
  STORED_METRICS_DEFAULT_LIMIT,
  STORED_METRICS_MAX_LIMIT,
} from "@/server/features/metrics-history/StoredMetricsService";

const STORED_NOTE =
  "Rows are stored daily snapshots refreshed by a scheduled ingest, not live API calls. Read-only; uses no credits.";

const dateSchema = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(`${label} (YYYY-MM-DD, inclusive).`);

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(STORED_METRICS_MAX_LIMIT)
  .optional()
  .describe(
    `Row cap for page, query_page, channel, landing_page and key_event grains (default ${STORED_METRICS_DEFAULT_LIMIT}, max ${STORED_METRICS_MAX_LIMIT}).`,
  );

const GSC_GRAINS = ["site", "device", "page", "query_page"] as const;
const GA4_GRAINS = ["total", "channel", "landing_page", "key_event"] as const;

export const gscDailyInputSchema = {
  projectId: projectIdSchema,
  startDate: dateSchema("Start date"),
  endDate: dateSchema("End date"),
  grain: z
    .enum(GSC_GRAINS)
    .describe(
      "site = one row per day (all devices); device = per-day per-device rows; page = per-day per-page rows ranked by clicks; query_page = per-day query+page rows ranked by orderBy.",
    ),
  limit: limitSchema,
  orderBy: z
    .enum(["clicks", "impressions"])
    .optional()
    .describe(
      "Ranking for query_page when the limit trims rows (default clicks).",
    ),
} as const;

export const ga4DailyInputSchema = {
  projectId: projectIdSchema,
  startDate: dateSchema("Start date"),
  endDate: dateSchema("End date"),
  grain: z
    .enum(GA4_GRAINS)
    .describe(
      "total = one row per day; channel = per-day per-channel group; landing_page = per-day landing pages; key_event = per-day key events by name.",
    ),
  limit: limitSchema,
} as const;

const projectIdOnlySchema = { projectId: projectIdSchema } as const;

const historyOutputSchema = z.looseObject({
  ok: z.boolean(),
  reason: z.string().optional(),
  grain: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rowCount: z.number().optional(),
  rows: z.array(z.looseObject({})).optional(),
  ...optionalMetaOutputSchema,
});

const annotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function roundMetrics<T extends { ctr: number; position: number }>(row: T): T {
  return { ...row, ctr: round(row.ctr, 4), position: round(row.position, 1) };
}

function invalidRequest(
  meta: ReturnType<typeof buildProjectMeta>,
  error: StoredMetricsInputError,
) {
  return mcpResponse({
    text: error.message,
    meta,
    structuredContent: { ok: false, reason: "invalid_request" },
  });
}

type GscArgs = z.infer<z.ZodObject<typeof gscDailyInputSchema>>;
type Ga4Args = z.infer<z.ZodObject<typeof ga4DailyInputSchema>>;
type StatusArgs = z.infer<z.ZodObject<typeof projectIdOnlySchema>>;

export const getMetricsHistoryStatusTool = {
  name: "get_metrics_history_status",
  config: {
    title: "Get stored metrics history status",
    description: `Report ingest state and coverage (first and last stored date, row counts per table) for the stored Search Console and Google Analytics daily history of a project. Use it to check whether history has been backfilled and when the scheduled ingest last succeeded or failed. For GSC, maxFinalizedDate is the latest day whose numbers are final. ${STORED_NOTE}`,
    inputSchema: projectIdOnlySchema,
    outputSchema: z.looseObject({
      ok: z.boolean(),
      gsc: z.looseObject({}).optional(),
      ga4: z.looseObject({}).optional(),
      ...optionalMetaOutputSchema,
    }),
    annotations,
  },
  handler: withMcpProjectAuth(async (args: StatusArgs, context) => {
    const status = await StoredMetricsService.getStatus(args.projectId);
    return mcpResponse({
      text: JSON.stringify({ ok: true, ...status }),
      meta: buildProjectMeta(context, args.projectId),
      structuredContent: { ok: true, ...status },
    });
  }),
};

export const getGscDailyHistoryTool = {
  name: "get_gsc_daily_history",
  config: {
    title: "Get stored Search Console daily history",
    description: `Read stored Search Console daily rows (clicks, impressions, ctr, position) by site, device, page or query+page. Each row carries finalized: false means Google may still revise that day, true means it is settled. ${STORED_NOTE}`,
    inputSchema: gscDailyInputSchema,
    outputSchema: historyOutputSchema,
    annotations,
  },
  handler: withMcpProjectAuth(async (args: GscArgs, context) => {
    const meta = buildProjectMeta(context, args.projectId);
    try {
      const rows = (
        await StoredMetricsService.getGscDaily(args.projectId, args)
      ).map(roundMetrics);
      return mcpResponse({
        text: JSON.stringify({ ok: true, grain: args.grain, rows }),
        meta,
        structuredContent: {
          ok: true,
          grain: args.grain,
          startDate: args.startDate,
          endDate: args.endDate,
          rowCount: rows.length,
          rows,
        },
      });
    } catch (error) {
      if (error instanceof StoredMetricsInputError)
        return invalidRequest(meta, error);
      throw error;
    }
  }),
};

export const getGa4DailyHistoryTool = {
  name: "get_ga4_daily_history",
  config: {
    title: "Get stored Google Analytics daily history",
    description: `Read stored Google Analytics 4 daily rows (sessions, users, engaged sessions, key events) by total, channel, landing page or key event. ${STORED_NOTE}`,
    inputSchema: ga4DailyInputSchema,
    outputSchema: historyOutputSchema,
    annotations,
  },
  handler: withMcpProjectAuth(async (args: Ga4Args, context) => {
    const meta = buildProjectMeta(context, args.projectId);
    try {
      const rows = await StoredMetricsService.getGa4Daily(args.projectId, args);
      return mcpResponse({
        text: JSON.stringify({ ok: true, grain: args.grain, rows }),
        meta,
        structuredContent: {
          ok: true,
          grain: args.grain,
          startDate: args.startDate,
          endDate: args.endDate,
          rowCount: rows.length,
          rows,
        },
      });
    } catch (error) {
      if (error instanceof StoredMetricsInputError)
        return invalidRequest(meta, error);
      throw error;
    }
  }),
};
