import {
  formatDay,
  KEY_EVENTS_NOT_COMPARABLE,
} from "@/client/features/traffic/trafficFormat";
import { fillDays, type DateSpan } from "@/client/features/traffic/trafficMath";
import type { getGa4TrafficHistory } from "@/serverFunctions/ga4Traffic";
import type { getOverviewSearchReport } from "@/serverFunctions/overview";
import type { OverviewDevice } from "@/types/schemas/overview";
import { buildKpi, covers, sumGa4, type Kpi } from "./overviewMetrics";
import type { KpiCardData } from "./OverviewKpis";
import { buildPageTable } from "./overviewPageRows";
import type { CompareWindow } from "./overviewRange";
import type { RankingsView } from "./overviewRankBands";
import {
  buildWhatChanged,
  type NewPagesSummary,
  type RankSummary,
} from "./overviewSentences";

type Connected<T> = Extract<Awaited<T>, { connected: true }>;
type Ga4History = Connected<ReturnType<typeof getGa4TrafficHistory>>;
type SearchReport = Connected<ReturnType<typeof getOverviewSearchReport>>;

function position(
  totals: { impressions: number; position: number } | null,
): number | null {
  return totals && totals.impressions > 0 ? totals.position : null;
}

export function spanLabel(span: DateSpan): string {
  return `${formatDay(span.start)} to ${formatDay(span.end)}`;
}

/** Everything the Overview shows that depends on the chosen windows, built
 *  from the three data sources. Pure, so a source that is missing or not
 *  connected simply contributes no cards. */
export function buildOverviewView(input: {
  current: DateSpan;
  reference: CompareWindow;
  ga4: Ga4History | null;
  gsc: SearchReport | null;
  rankView: RankingsView | null;
  hasTracker: boolean;
  device: OverviewDevice;
  launch: string;
  launchInPast: boolean;
  lookbackEnd: string;
}) {
  const { current, reference, ga4, gsc, rankView } = input;
  const label = spanLabel;
  const scale = reference.scale;
  const currentLabel = label(current);
  const compareLabel = reference.isAverage
    ? `the 12 weeks before launch (${label(reference)}), scaled to the same number of days`
    : label(reference);

  // Key events were a different event before launch, so both windows must sit
  // entirely on or after the launch date to be compared.
  const keyEventsComparable =
    current.start >= input.launch && reference.start >= input.launch;

  const kpis: Partial<Record<Kpi["key"], KpiCardData>> = {};
  if (ga4?.dataStart) {
    const coverage = { start: ga4.dataStart, end: ga4.dataEnd };
    const days = fillDays(ga4.days, coverage);
    const now = covers(coverage, current) ? sumGa4(days, current) : null;
    const before = covers(coverage, reference) ? sumGa4(days, reference) : null;
    const note = !now
      ? "Google Analytics does not cover this whole window"
      : !before
        ? "No Google Analytics data for the comparison window"
        : undefined;
    for (const key of ["keyEvents", "sessions"] as const) {
      kpis[key] = {
        kpi: buildKpi({
          key,
          current: now ? now[key] : null,
          base:
            before && (key !== "keyEvents" || keyEventsComparable)
              ? before[key]
              : null,
          scale,
        }),
        currentLabel,
        compareLabel,
        note:
          key === "keyEvents" && !keyEventsComparable && now
            ? KEY_EVENTS_NOT_COMPARABLE
            : note,
      };
    }
  }
  if (gsc) {
    const now = gsc.totals;
    const before = gsc.compareTotals;
    const note = !now
      ? "Search Console history does not reach this window"
      : !before
        ? "Search Console history does not reach the comparison window"
        : undefined;
    kpis.clicks = {
      kpi: buildKpi({
        key: "clicks",
        current: now ? now.clicks : null,
        base: before ? before.clicks : null,
        scale,
      }),
      currentLabel,
      compareLabel,
      note,
    };
    kpis.impressions = {
      kpi: buildKpi({
        key: "impressions",
        current: now ? now.impressions : null,
        base: before ? before.impressions : null,
        scale,
      }),
      currentLabel,
      compareLabel,
      note,
    };
    kpis.position = {
      kpi: buildKpi({
        key: "position",
        current: position(now),
        base: position(before),
      }),
      currentLabel,
      compareLabel,
      note,
    };
  }

  const rankSummary: RankSummary | null =
    rankView && input.hasTracker
      ? {
          device: input.device,
          total: rankView.total,
          checked: rankView.checked,
          latestLabel: formatDay(rankView.latest.checkedAt.slice(0, 10)),
          topTenNow: rankView.topTenNow,
          topTenBefore: rankView.topTenBefore,
          previousLabel: rankView.previous
            ? formatDay(rankView.previous.checkedAt.slice(0, 10))
            : null,
        }
      : null;

  const lookbackLabel =
    gsc?.lookbackStart && input.launchInPast
      ? label({ start: gsc.lookbackStart, end: input.lookbackEnd })
      : null;
  const newPages: NewPagesSummary | null =
    gsc?.newPages && lookbackLabel
      ? {
          count: gsc.newPages.length,
          lookbackLabel,
          maybeIncomplete: gsc.lookbackTruncated || gsc.pagesTruncated,
        }
      : null;

  const sentences = buildWhatChanged({
    currentLabel,
    compareLabel,
    kpis: Object.fromEntries(
      Object.values(kpis).map((card) => [card.kpi.key, card.kpi]),
    ),
    rankings: rankSummary,
    keyEventsNotComparable: !keyEventsComparable,
    newPages,
  });

  const comparePages = gsc?.comparePages ?? null;
  const topRows = gsc
    ? buildPageTable({ pages: gsc.pages, comparePages, scale })
    : [];
  const newRows =
    gsc?.newPages && lookbackLabel
      ? buildPageTable({ pages: gsc.newPages, comparePages, scale })
      : null;

  const order: Kpi["key"][] = [
    "keyEvents",
    "sessions",
    "clicks",
    "impressions",
    "position",
  ];
  return {
    currentLabel,
    compareLabel,
    cards: order.flatMap((key) => (kpis[key] ? [kpis[key]] : [])),
    sentences,
    topRows,
    newRows,
    lookbackLabel,
    gsc,
    ga4,
  };
}
