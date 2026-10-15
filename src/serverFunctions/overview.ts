import { createServerFn } from "@tanstack/react-start";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import {
  sumSearchTotals,
  toDimensionRows,
} from "@/server/features/gsc/searchPerformanceReport";
import {
  GscNotConnectedError,
  GscService,
  isExpectedGrantFailure,
} from "@/server/features/gsc/services/GscService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { overviewSearchReportInputSchema } from "@/types/schemas/overview";

// NEW read-only server function for the Overview (Quiet Coyote PR 3).
// The existing Search Performance functions only accept fixed presets; the
// Overview needs arbitrary windows (since launch, custom, same period last
// year), so this reads the same GscService.getPerformance with explicit dates.
// Free first-party Search Console data, no paid API calls.

const DAILY_ROW_LIMIT = 500;
const PAGE_ROW_LIMIT = 1000;
// The "seen before launch" lookback spans months, so it needs a deeper read.
const LOOKBACK_ROW_LIMIT = 5000;

type Span = { start: string; end: string };

/** GSC silently moves a start date older than its 16-month floor. Comparing a
 *  clamped window with an unclamped one would be a lie, so report it. */
function resolveSpan(span: Span) {
  const resolved = resolveDateRange({
    startDate: span.start,
    endDate: span.end,
  });
  return {
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    clamped: resolved.startDate !== span.start,
  };
}

async function readTotals(projectId: string, span: Span) {
  const { startDate, endDate, clamped } = resolveSpan(span);
  if (clamped) return { clamped: true as const };
  const result = await GscService.getPerformance({
    projectId,
    startDate,
    endDate,
    dimensions: ["date"],
    rowLimit: DAILY_ROW_LIMIT,
  });
  return { clamped: false as const, totals: sumSearchTotals(result.rows) };
}

async function readPages(
  projectId: string,
  span: Span,
  rowLimit: number,
  allowClamp = false,
) {
  const { startDate, endDate, clamped } = resolveSpan(span);
  if (clamped && !allowClamp) return { clamped: true as const };
  const result = await GscService.getPerformance({
    projectId,
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit,
  });
  const rows = toDimensionRows(result.rows);
  return {
    clamped: false as const,
    startDate,
    rows,
    truncated: result.rows.length >= rowLimit,
  };
}

export const getOverviewSearchReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(overviewSearchReportInputSchema)
  .handler(async ({ data, context }) => {
    const projectId = context.projectId;
    try {
      const [current, compare, pages, comparePages, lookback] =
        await Promise.all([
          readTotals(projectId, data.current),
          data.compare ? readTotals(projectId, data.compare) : null,
          readPages(projectId, data.current, PAGE_ROW_LIMIT),
          data.compare
            ? readPages(projectId, data.compare, PAGE_ROW_LIMIT)
            : null,
          data.preLaunch
            ? readPages(projectId, data.preLaunch, LOOKBACK_ROW_LIMIT, true)
            : null,
        ]);

      const seenBefore =
        lookback && !lookback.clamped
          ? new Set(lookback.rows.map((row) => row.key))
          : null;
      const currentRows = pages.clamped ? [] : pages.rows;

      return {
        connected: true as const,
        totals: current.clamped ? null : current.totals,
        compareTotals: compare && !compare.clamped ? compare.totals : null,
        pages: currentRows,
        pagesTruncated: !pages.clamped && pages.truncated,
        comparePages:
          comparePages && !comparePages.clamped ? comparePages.rows : null,
        // Pages with impressions in the current window and none in the
        // lookback. Null when the lookback could not be read in full.
        newPages: seenBefore
          ? currentRows.filter((row) => !seenBefore.has(row.key))
          : null,
        lookbackTruncated: Boolean(
          lookback && !lookback.clamped && lookback.truncated,
        ),
        // First day actually read for the lookback (GSC keeps about 16 months).
        lookbackStart:
          lookback && !lookback.clamped ? lookback.startDate : null,
      };
    } catch (error) {
      if (
        error instanceof GscNotConnectedError ||
        isExpectedGrantFailure(error)
      ) {
        return { connected: false as const };
      }
      throw error;
    }
  });
