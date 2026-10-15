import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Skeleton } from "@/client/components/ui/skeleton";
import { GoogleConnectionCard } from "@/client/features/integrations/GoogleConnectionCard";
import { formatDay } from "@/client/features/traffic/trafficFormat";
import { daysBetween, fillDays } from "@/client/features/traffic/trafficMath";
import { getGa4TrafficHistory } from "@/serverFunctions/ga4Traffic";
import { getOverviewSearchReport } from "@/serverFunctions/overview";
import type { OverviewSearch } from "@/types/schemas/overview";
import { OverviewKpis } from "./OverviewKpis";
import { buildOverviewView, spanLabel as label } from "./overviewView";
import { OverviewOffsiteAuthority } from "./OverviewOffsiteAuthority";
import { OverviewPages } from "./OverviewPages";
import { OverviewRankings } from "./OverviewRankings";
import {
  COMPARE_LABELS,
  latestDataDate,
  lookbackWindow,
  preLaunchWindow,
  resolveCompare,
  resolveWindow,
  RANGE_LABELS,
} from "./overviewRange";
import { OverviewTrend } from "./OverviewTrend";
import { RangeCompareControl } from "./RangeCompareControl";
import { useOverviewRankings } from "./useOverviewRankings";

const STALE = 5 * 60 * 1000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OverviewPage({
  projectId,
  search,
  onSearchChange,
}: {
  projectId: string;
  search: OverviewSearch;
  onSearchChange: (update: Partial<OverviewSearch>) => void;
}) {
  const { range, compare, launch } = search;
  const asOf = useMemo(() => latestDataDate(today()), []);
  const current = resolveWindow({
    range,
    asOf,
    launch,
    from: search.from,
    to: search.to,
  });
  const reference = current
    ? resolveCompare({ compare, current, launch })
    : null;
  const lookback = lookbackWindow(launch);
  const launchInPast = launch <= asOf;

  const ga4Query = useQuery({
    queryKey: ["ga4TrafficHistory", projectId, "organic_search"],
    queryFn: () =>
      getGa4TrafficHistory({ data: { projectId, channel: "organic_search" } }),
    staleTime: STALE,
  });
  const gscQuery = useQuery({
    queryKey: [
      "overviewSearchReport",
      projectId,
      current,
      reference && { start: reference.start, end: reference.end },
      launchInPast ? lookback : null,
    ],
    enabled: current !== null,
    queryFn: () =>
      getOverviewSearchReport({
        data: {
          projectId,
          current: current ?? { start: asOf, end: asOf },
          compare: reference
            ? { start: reference.start, end: reference.end }
            : null,
          preLaunch: launchInPast ? lookback : null,
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: STALE,
  });
  const rankings = useOverviewRankings({
    projectId,
    tracker: search.tracker,
    device: search.device,
  });

  const view =
    current && reference
      ? buildOverviewView({
          current,
          reference,
          ga4: ga4Query.data?.connected ? ga4Query.data : null,
          gsc: gscQuery.data?.connected ? gscQuery.data : null,
          rankView: rankings.view,
          hasTracker: rankings.config !== null,
          device: search.device,
          launch,
          launchInPast,
          lookbackEnd: lookback.end,
        })
      : null;

  const ga4Coverage = view?.ga4?.dataStart
    ? { start: view.ga4.dataStart, end: view.ga4.dataEnd }
    : null;
  const ga4Days = useMemo(
    () =>
      view?.ga4?.dataStart
        ? fillDays(view.ga4.days, {
            start: view.ga4.dataStart,
            end: view.ga4.dataEnd,
          })
        : [],
    [view?.ga4],
  );
  const loading =
    ga4Query.isPending || (current !== null && gscQuery.isPending);

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            How the site is doing in Google, in plain terms. Every number prints
            the dates it covers and where it came from.
          </p>
        </div>

        <RangeCompareControl
          value={{
            range,
            compare,
            launch,
            from: search.from,
            to: search.to,
            marker: search.marker,
          }}
          onChange={(update) => onSearchChange(update)}
        />

        {current === null || reference === null ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {range === "custom"
              ? "Pick both a start and an end date for the custom range."
              : `The ${RANGE_LABELS[range].toLowerCase()} window starts on ${formatDay(launch)}, which is after the latest day with data.`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {RANGE_LABELS[range]}: {label(current)}. Compared with{" "}
            {COMPARE_LABELS[compare].toLowerCase()}: {label(reference)}
            {reference.isAverage
              ? ` (${label(preLaunchWindow(launch))} averaged per day and scaled to the same number of days)`
              : ""}
            . Data runs to {formatDay(asOf)} because Google reports a few days
            late.
          </p>
        )}

        {loading ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        ) : view ? (
          <>
            {view.sentences.length > 0 ? (
              <section aria-label="What changed">
                <CardShell title="What changed">
                  <ul className="list-disc space-y-2 pl-5 text-sm">
                    {view.sentences.map((sentence) => (
                      <li key={sentence}>{sentence}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Written from the numbers below. It says what moved, not why.
                  </p>
                </CardShell>
              </section>
            ) : null}

            {gscQuery.isError && !gscQuery.data ? (
              <QueryError
                error={gscQuery.error}
                fallback="Failed to load Search Console data"
                onRetry={() => void gscQuery.refetch()}
                isRetrying={gscQuery.isFetching}
              />
            ) : null}
            {ga4Query.isError && !ga4Query.data ? (
              <QueryError
                error={ga4Query.error}
                fallback="Failed to load Google Analytics data"
                onRetry={() => void ga4Query.refetch()}
                isRetrying={ga4Query.isFetching}
              />
            ) : null}

            {view.cards.length > 0 ? <OverviewKpis cards={view.cards} /> : null}

            {gscQuery.data && !gscQuery.data.connected ? (
              <div className="max-w-2xl">
                <GoogleConnectionCard provider="gsc" projectId={projectId} />
              </div>
            ) : null}
            {ga4Query.data && !ga4Query.data.connected ? (
              <div className="max-w-2xl">
                <GoogleConnectionCard provider="ga4" projectId={projectId} />
              </div>
            ) : null}

            <OverviewRankings
              projectId={projectId}
              rankings={rankings}
              device={search.device}
              onTrackerChange={(tracker) => onSearchChange({ tracker })}
              onDeviceChange={(device) => onSearchChange({ device })}
            />

            {view.gsc ? (
              <OverviewPages
                tab={search.pages}
                onTabChange={(pages) => onSearchChange({ pages })}
                topRows={view.topRows}
                newRows={view.newRows}
                windowLabel={view.currentLabel}
                compareLabel={view.compareLabel}
                lookbackLabel={view.lookbackLabel}
                lookbackNote={
                  launchInPast
                    ? "Search Console keeps about 16 months, so a page first seen earlier than that can look new."
                    : "The launch date is after the latest data day, so nothing can be new since launch yet."
                }
                truncatedNote={
                  view.gsc.pagesTruncated
                    ? "Search Console returned its row limit for this window, so the smallest pages are left out."
                    : null
                }
              />
            ) : null}

            <OverviewOffsiteAuthority projectId={projectId} />

            {ga4Coverage && current ? (
              <OverviewTrend
                projectId={projectId}
                days={ga4Days}
                coverage={ga4Coverage}
                window={current}
                launch={launch}
                markerHidden={!search.marker}
                spanDays={daysBetween(current.start, current.end)}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
