import { AppError } from "@/server/lib/errors";
import { MetricsHistoryRepository as repo } from "./MetricsHistoryRepository";

export const STORED_METRICS_DEFAULT_LIMIT = 250;
export const STORED_METRICS_MAX_LIMIT = 1000;

export class StoredMetricsInputError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "StoredMetricsInputError";
  }
}

export type GscGrain = "site" | "device" | "page" | "query_page";
export type Ga4Grain = "total" | "channel" | "landing_page" | "key_event";

type DateRange = { startDate: string; endDate: string };

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validateRange({ startDate, endDate }: DateRange) {
  if (!isRealDate(startDate))
    throw new StoredMetricsInputError(
      "startDate must be a real YYYY-MM-DD date.",
    );
  if (!isRealDate(endDate))
    throw new StoredMetricsInputError(
      "endDate must be a real YYYY-MM-DD date.",
    );
  if (startDate > endDate)
    throw new StoredMetricsInputError(
      "startDate must be on or before endDate.",
    );
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return STORED_METRICS_DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit < 1)
    throw new StoredMetricsInputError("limit must be a positive number.");
  return Math.min(Math.floor(limit), STORED_METRICS_MAX_LIMIT);
}

type IngestState = Awaited<ReturnType<typeof repo.getState>>;

const toState = (row: IngestState | null) =>
  row && {
    claimed_at: row.claimedAt,
    last_run_at: row.lastRunAt,
    last_success_at: row.lastSuccessAt,
    last_error: row.lastError,
    backfill_cursor_date: row.backfillCursorDate,
    backfill_done: row.backfillDone,
  };
async function getStatus(projectId: string) {
  const [gscState, ga4State, coverage] = await Promise.all([
    repo.getState(projectId, "gsc"),
    repo.getState(projectId, "ga4"),
    repo.coverage(projectId),
  ]);
  const { rowCounts } = coverage;
  return {
    gsc: {
      state: toState(gscState),
      coverage: {
        ...coverage.gsc,
        rowCounts: {
          site: rowCounts.gscDailySite,
          page: rowCounts.gscDailyPage,
          queryPage: rowCounts.gscDailyQueryPage,
        },
      },
    },
    ga4: {
      state: toState(ga4State),
      coverage: {
        ...coverage.ga4,
        rowCounts: {
          total: rowCounts.ga4DailyTotal,
          channel: rowCounts.ga4DailyChannel,
          landingPage: rowCounts.ga4DailyLandingPage,
          keyEvent: rowCounts.ga4DailyKeyEvent,
        },
      },
    },
  };
}

async function getGscDaily(
  projectId: string,
  input: DateRange & {
    grain: GscGrain;
    limit?: number;
    orderBy?: "clicks" | "impressions";
  },
) {
  validateRange(input);
  const { startDate, endDate } = input;
  if (input.grain === "site" || input.grain === "device") {
    const rows = await repo.getGscSite(projectId, startDate, endDate);
    return rows.filter((row) =>
      input.grain === "site" ? row.device === "" : row.device !== "",
    );
  }
  const limit = clampLimit(input.limit);
  if (input.grain === "page")
    return repo.getGscPage(projectId, startDate, endDate, limit);
  return repo.getGscQueryPage(projectId, startDate, endDate, {
    limit,
    orderBy: input.orderBy ?? "clicks",
  });
}

async function getGa4Daily(
  projectId: string,
  input: DateRange & { grain: Ga4Grain; limit?: number },
) {
  validateRange(input);
  const { startDate, endDate } = input;
  if (input.grain === "total")
    return repo.getGa4Total(projectId, startDate, endDate);
  const limit = clampLimit(input.limit);
  const rows =
    input.grain === "channel"
      ? await repo.getGa4Channel(projectId, startDate, endDate)
      : input.grain === "landing_page"
        ? await repo.getGa4LandingPage(projectId, startDate, endDate)
        : await repo.getGa4KeyEvent(projectId, startDate, endDate);
  return rows.slice(0, limit);
}

export const StoredMetricsService = { getStatus, getGscDaily, getGa4Daily };
