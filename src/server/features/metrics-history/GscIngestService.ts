import type { gscConnections } from "@/db/schema";
import { buildSearchAnalyticsRequest } from "@/server/features/gsc/searchAnalytics";
import type { GscDimension } from "@/server/features/gsc/searchAnalytics";
import {
  createGscClient,
  type GscSearchAnalyticsRow,
} from "@/server/lib/gscClient";
import { shiftDate } from "./ingestDates";
import {
  MetricsHistoryRepository as repo,
  type GscPageRow,
  type GscQueryPageRow,
  type GscSiteRow,
} from "./MetricsHistoryRepository";

type GscConnectionRow = typeof gscConnections.$inferSelect;

const ROW_LIMIT = 25_000;
// GSC revises roughly the last three days; five gives a safety margin.
const FINALIZE_LAG_DAYS = 5;

type DailyRows = {
  site: GscSiteRow[];
  page: GscPageRow[];
  queryPage: GscQueryPageRow[];
};

/**
 * Shapes raw searchAnalytics rows into repository rows. Row `keys` are
 * positional per the requested dimension order. A row is finalized when its
 * date is on or before `finalizedBefore`. Which output array fills depends on
 * the dimensions: [date] / [date, device] -> site, [date, page] -> page,
 * [date, query, page, device] -> queryPage.
 */
export function gscRowsToDaily(
  dimensions: readonly string[],
  rows: GscSearchAnalyticsRow[],
  finalizedBefore: string,
): DailyRows {
  const out: DailyRows = { site: [], page: [], queryPage: [] };
  const at = (name: string) => dimensions.indexOf(name);
  const dateIdx = at("date");
  const deviceIdx = at("device");
  const pageIdx = at("page");
  const queryIdx = at("query");
  for (const row of rows) {
    const keys = row.keys ?? [];
    const date = keys[dateIdx];
    if (dateIdx < 0 || !date) continue;
    const metrics = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      finalized: date <= finalizedBefore,
    };
    const device = deviceIdx >= 0 ? (keys[deviceIdx] ?? "") : "";
    if (queryIdx >= 0 && pageIdx >= 0) {
      out.queryPage.push({
        date,
        query: keys[queryIdx] ?? "",
        page: keys[pageIdx] ?? "",
        device,
        ...metrics,
      });
    } else if (pageIdx >= 0) {
      out.page.push({ date, page: keys[pageIdx] ?? "", ...metrics });
    } else {
      out.site.push({ date, device, ...metrics });
    }
  }
  return out;
}

/** Fetches one window of GSC daily rows and upserts them. */
export async function ingestGscWindow(
  connection: GscConnectionRow,
  startDate: string,
  endDate: string,
  opts: { today: string },
) {
  const client = createGscClient({
    userId: connection.connectedByUserId,
    gscAccountId: connection.gscAccountId ?? undefined,
  });
  const finalizedBefore = shiftDate(opts.today, -FINALIZE_LAG_DAYS);
  const fetched = { site: 0, page: 0, queryPage: 0 };
  let requests = 0;

  const run = async (
    dimensions: GscDimension[],
    save: (rows: DailyRows) => Promise<void>,
  ) => {
    for (let startRow = 0; ; startRow += ROW_LIMIT) {
      const request = buildSearchAnalyticsRequest({
        projectId: connection.projectId,
        dimensions,
        startDate,
        endDate,
        type: "web",
        dataState: "all",
        startRow,
      });
      request.rowLimit = ROW_LIMIT;
      const rows = await client.querySearchAnalytics(
        connection.siteUrl,
        request,
      );
      requests += 1;
      await save(gscRowsToDaily(dimensions, rows, finalizedBefore));
      if (rows.length < ROW_LIMIT) break;
    }
  };

  const saveSite = async (r: DailyRows) => {
    fetched.site += r.site.length;
    await repo.upsertGscSite(connection.projectId, r.site);
  };
  await run(["date"], saveSite);
  await run(["date", "device"], saveSite);
  await run(["date", "page"], async (r) => {
    fetched.page += r.page.length;
    await repo.upsertGscPage(connection.projectId, r.page);
  });
  await run(["date", "query", "page", "device"], async (r) => {
    fetched.queryPage += r.queryPage.length;
    await repo.upsertGscQueryPage(connection.projectId, r.queryPage);
  });
  return { fetched, requests };
}
