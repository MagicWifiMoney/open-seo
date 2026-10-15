import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  createGa4DataClient,
  type Ga4RunReportRequest,
} from "@/server/lib/ga4Client";
import { Ga4ReportError } from "@/server/lib/ga4Errors";
import {
  TRAFFIC_CHANNEL_GROUP_NAMES,
  type TrafficChannel,
} from "@/types/schemas/traffic";
import { normalizeGa4Response } from "./Ga4ReportNormalization";
import { mapGa4ReportError, resolveGa4DateRange } from "./Ga4ReportingService";

/** GA4 launched 2015-08-14; no property can hold data before it. The first
 *  row returned is therefore the property's earliest data. */
export const GA4_HISTORY_FLOOR = "2015-08-14";
/** GA4 allows 250k rows per request; one row per day keeps this tiny. */
const PAGE_LIMIT = 10_000;
/** Hard cap on pages so a malformed totalRowCount can never loop. */
const MAX_PAGES = 3;

export type TrafficHistoryDay = {
  date: string;
  sessions: number;
  users: number;
  keyEvents: number;
};

export function buildTrafficHistoryRequest(input: {
  startDate: string;
  endDate: string;
  channel: TrafficChannel;
  offset: number;
}): Ga4RunReportRequest {
  return {
    dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "keyEvents" },
    ],
    dimensionFilter:
      input.channel === "all"
        ? undefined
        : {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              stringFilter: {
                matchType: "EXACT",
                value: TRAFFIC_CHANNEL_GROUP_NAMES[input.channel],
              },
            },
          },
    offset: String(input.offset),
    limit: String(PAGE_LIMIT),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  };
}

/** GA4's `date` dimension is YYYYMMDD. */
export function toIsoDate(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function rowsToDays(
  rows: Array<Record<string, string | number | null>>,
): TrafficHistoryDay[] {
  const days: TrafficHistoryDay[] = [];
  for (const row of rows) {
    if (typeof row.date !== "string") continue;
    const date = toIsoDate(row.date);
    if (!date) continue;
    days.push({
      date,
      sessions: typeof row.sessions === "number" ? row.sessions : 0,
      users: typeof row.activeUsers === "number" ? row.activeUsers : 0,
      keyEvents: typeof row.keyEvents === "number" ? row.keyEvents : 0,
    });
  }
  return days;
}

/** Full daily history (earliest data to the last complete day) for one
 *  channel view. Read-only GA4 Data API calls; no paid APIs. */
async function getHistory(
  input: { projectId: string; channel: TrafficChannel },
  opts: { now?: Date } = {},
) {
  const connection = await Ga4ConnectionRepository.getByProjectId(
    input.projectId,
  );
  if (!connection) {
    throw new Ga4ReportError(
      "ga4_not_connected",
      "Google Analytics is not connected for this project.",
    );
  }
  // No dates: resolves endDate to the last complete day in the property's
  // time zone (and start to 28 days earlier, which we ignore).
  const { resolvedDateRange } = resolveGa4DateRange(
    {},
    connection.propertyTimeZone,
    opts.now,
  );
  const endDate = resolvedDateRange.endDate;
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });

  try {
    const days: TrafficHistoryDay[] = [];
    let hasLimitedData = false;
    let truncated = false;
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const request = buildTrafficHistoryRequest({
        startDate: GA4_HISTORY_FLOOR,
        endDate,
        channel: input.channel,
        offset,
      });
      const report = normalizeGa4Response(
        await client.runReport(request),
        request,
      );
      hasLimitedData ||= report.reportMetadata.hasLimitedData;
      days.push(...rowsToDays(report.rows));
      offset += report.rows.length;
      if (report.rows.length === 0 || offset >= report.totalRowCount) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }
    return {
      connected: true as const,
      propertyDisplayName: connection.propertyDisplayName,
      propertyTimeZone: connection.propertyTimeZone,
      channel: input.channel,
      dataStart: days[0]?.date ?? null,
      dataEnd: endDate,
      days,
      hasLimitedData,
      truncated,
    };
  } catch (error) {
    mapGa4ReportError(error);
  }
}

export const Ga4TrafficHistoryService = { getHistory };
