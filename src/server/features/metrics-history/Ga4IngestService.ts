import type { ga4Connections } from "@/db/schema";
import {
  GA4_HISTORY_FLOOR,
  toIsoDate,
} from "@/server/features/ga4/services/Ga4TrafficHistoryService";
import {
  createGa4DataClient,
  type Ga4RunReportRequest,
  type Ga4RunReportResponse,
} from "@/server/lib/ga4Client";
import { shiftDate } from "./ingestDates";
import {
  MetricsHistoryRepository as repo,
  type Ga4ChannelRow,
  type Ga4KeyEventRow,
  type Ga4LandingPageRow,
  type Ga4TotalRow,
} from "./MetricsHistoryRepository";

type Ga4ConnectionRow = typeof ga4Connections.$inferSelect;
type Ga4Row = NonNullable<Ga4RunReportResponse["rows"]>[number];

const PAGE_LIMIT = 1000;
// Safety cap so a misbehaving property can never loop forever.
const MAX_PAGES = 500;

export type Ga4ReportKind = "total" | "channel" | "landingPage" | "keyEvent";

const TOTAL_METRICS = [
  "sessions",
  "activeUsers",
  "engagedSessions",
  "keyEvents",
];

const REPORTS: Record<
  Ga4ReportKind,
  { dimensions: string[]; metrics: string[]; keyEventsOnly?: boolean }
> = {
  total: { dimensions: ["date"], metrics: TOTAL_METRICS },
  channel: {
    dimensions: ["date", "sessionDefaultChannelGroup"],
    metrics: TOTAL_METRICS,
  },
  landingPage: {
    dimensions: ["date", "sessionDefaultChannelGroup", "landingPage"],
    metrics: ["sessions", "engagedSessions", "keyEvents"],
  },
  keyEvent: {
    dimensions: ["date", "sessionDefaultChannelGroup", "eventName"],
    metrics: ["keyEvents", "totalUsers"],
    keyEventsOnly: true,
  },
};

type DailyByKind = {
  total: Ga4TotalRow[];
  channel: Ga4ChannelRow[];
  landingPage: Ga4LandingPageRow[];
  keyEvent: Ga4KeyEventRow[];
};

const num = (value: string | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Shapes raw GA4 runReport rows (positional dimension and metric values). */
export function ga4RowsToDaily<K extends Ga4ReportKind>(
  kind: K,
  rows: Ga4Row[],
): DailyByKind[K];
export function ga4RowsToDaily(
  kind: Ga4ReportKind,
  rows: Ga4Row[],
): DailyByKind[Ga4ReportKind] {
  const out: Array<
    Ga4TotalRow | Ga4ChannelRow | Ga4LandingPageRow | Ga4KeyEventRow
  > = [];
  for (const row of rows) {
    const d = (row.dimensionValues ?? []).map((v) => v.value);
    const m = (row.metricValues ?? []).map((v) => v.value);
    const date = toIsoDate(d[0] ?? "");
    if (!date) continue;
    if (kind === "total") {
      out.push({
        date,
        sessions: num(m[0]),
        activeUsers: num(m[1]),
        engagedSessions: num(m[2]),
        keyEvents: num(m[3]),
      });
    } else if (kind === "channel") {
      out.push({
        date,
        channelGroup: d[1] ?? "",
        sessions: num(m[0]),
        activeUsers: num(m[1]),
        engagedSessions: num(m[2]),
        keyEvents: num(m[3]),
      });
    } else if (kind === "landingPage") {
      out.push({
        date,
        channelGroup: d[1] ?? "",
        landingPage: d[2] ?? "",
        sessions: num(m[0]),
        engagedSessions: num(m[1]),
        keyEvents: num(m[2]),
      });
    } else {
      out.push({
        date,
        channelGroup: d[1] ?? "",
        eventName: d[2] ?? "",
        keyEvents: num(m[0]),
        totalUsers: num(m[1]),
      });
    }
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the overload ties the output element type to `kind`
  return out as DailyByKind[Ga4ReportKind];
}

function buildRequest(
  kind: Ga4ReportKind,
  startDate: string,
  endDate: string,
  offset: number,
): Ga4RunReportRequest {
  const def = REPORTS[kind];
  return {
    dateRanges: [{ startDate, endDate }],
    dimensions: def.dimensions.map((name) => ({ name })),
    metrics: def.metrics.map((name) => ({ name })),
    metricFilter: def.keyEventsOnly
      ? {
          filter: {
            fieldName: "keyEvents",
            numericFilter: {
              operation: "GREATER_THAN",
              value: { doubleValue: 0 },
            },
          },
        }
      : undefined,
    offset: String(offset),
    limit: String(PAGE_LIMIT),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  };
}

function clientFor(connection: Ga4ConnectionRow) {
  return createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });
}

/** Fetches one window of GA4 daily rows and upserts them. */
export async function ingestGa4Window(
  connection: Ga4ConnectionRow,
  startDate: string,
  endDate: string,
) {
  const client = clientFor(connection);
  const projectId = connection.projectId;
  const fetched = { total: 0, channel: 0, landingPage: 0, keyEvent: 0 };
  let requests = 0;

  const run = async <K extends Ga4ReportKind>(
    kind: K,
    save: (rows: DailyByKind[K]) => Promise<void>,
  ) => {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const report = await client.runReport(
        buildRequest(kind, startDate, endDate, page * PAGE_LIMIT),
      );
      requests += 1;
      const raw = report.rows ?? [];
      const rows = ga4RowsToDaily(kind, raw);
      fetched[kind] += rows.length;
      await save(rows);
      if (raw.length < PAGE_LIMIT) break;
    }
  };

  await run("total", (r) => repo.upsertGa4Total(projectId, r));
  await run("channel", (r) => repo.upsertGa4Channel(projectId, r));
  await run("landingPage", (r) => repo.upsertGa4LandingPage(projectId, r));
  await run("keyEvent", (r) => repo.upsertGa4KeyEvent(projectId, r));
  return { fetched, requests };
}

/** Earliest date with data for the property, or null when it has none. */
export async function findGa4PropertyStart(
  connection: Ga4ConnectionRow,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<string | null> {
  const report = await clientFor(connection).runReport({
    dateRanges: [
      { startDate: GA4_HISTORY_FLOOR, endDate: shiftDate(today, -1) },
    ],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    offset: "0",
    limit: "1",
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
    returnPropertyQuota: true,
  });
  const first = report.rows?.[0]?.dimensionValues?.[0]?.value;
  return first ? toIsoDate(first) : null;
}
