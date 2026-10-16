import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { preLaunchWindow } from "@/client/features/overview/overviewRange";
import { QueryError } from "@/client/components/QueryState";
import { Skeleton } from "@/client/components/ui/skeleton";
import { GoogleConnectionCard } from "@/client/features/integrations/GoogleConnectionCard";
import { getGa4TrafficHistory } from "@/serverFunctions/ga4Traffic";
import type { TrafficSearch } from "@/types/schemas/traffic";
import { TrafficChart } from "./TrafficChart";
import { TrafficControls } from "./TrafficControls";
import { TrafficKpiCards } from "./TrafficKpiCards";
import { launchWindowPeriods } from "./trafficLaunchWindow";
import { TrafficTable } from "./TrafficTable";
import { buildTableRows } from "./trafficCsv";
import {
  CHANNEL_LABELS,
  formatDay,
  KEY_EVENTS_NOT_COMPARABLE,
  RANGE_LABELS,
} from "./trafficFormat";
import {
  baselineForGranularity,
  fillDays,
  isComparableAcrossLaunch,
  launchBucketKey,
  metricField,
  postLaunchAverage,
  resolveRange,
  straddlesLaunch,
  visibleBuckets,
  yoyAverage,
} from "./trafficMath";

export function TrafficPage({
  projectId,
  search,
  onSearchChange,
}: {
  projectId: string;
  search: TrafficSearch;
  onSearchChange: (update: Partial<TrafficSearch>) => void;
}) {
  const { channel, launch, granularity, metric, range } = search;
  const query = useQuery({
    queryKey: ["ga4TrafficHistory", projectId, channel],
    queryFn: () => getGa4TrafficHistory({ data: { projectId, channel } }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
  const history = query.data?.connected ? query.data : null;

  const view = useMemo(() => {
    if (!history || !history.dataStart) return null;
    const coverage = { start: history.dataStart, end: history.dataEnd };
    const days = fillDays(history.days, coverage);
    const selected = resolveRange({
      range,
      coverage,
      launch,
      from: search.from,
      to: search.to,
    });
    const { buckets, partialOmitted } = visibleBuckets(
      days,
      granularity,
      coverage,
      selected,
    );
    // Key events are not like-for-like across launch: no baseline for them.
    // The reference is the same 12 weeks before launch the Overview uses.
    const preStart = preLaunchWindow(launch).start;
    const baselineBucket = isComparableAcrossLaunch(metric)
      ? baselineForGranularity(days, granularity, coverage, launch, preStart)
      : null;
    const field = metricField(metric);
    const launchWindow = launchWindowPeriods(days, coverage, launch);
    const post = launchWindow.post;
    // Year-on-year still compares whole Monday to Sunday weeks.
    const weeklyPost = postLaunchAverage(days, "week", coverage, launch);
    const straddle = buckets.find((bucket) =>
      straddlesLaunch(bucket, launch, granularity),
    );
    return {
      coverage,
      selected,
      buckets,
      partialOmitted,
      baselineBucket,
      rows: buildTableRows(
        buckets,
        baselineBucket ? baselineBucket.averages[field] : null,
        field,
        launch,
        granularity,
      ),
      straddleKey: straddle ? straddle.start : null,
      launchKey: launchBucketKey(launch, granularity, buckets),
      post,
      weeklyPost,
      baseline: launchWindow.baseline,
      baselineSpan: baselineBucket
        ? `${formatDay(baselineBucket.start)} to ${formatDay(baselineBucket.end)}`
        : undefined,
      yoy: weeklyPost ? yoyAverage(days, weeklyPost, coverage) : null,
    };
  }, [history, range, launch, granularity, metric, search.from, search.to]);

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Traffic history</h1>
          <p className="text-sm text-muted-foreground">
            Google Analytics traffic from the 12 weeks before launch to now,
            with the site launch marked and everything since it compared with
            the 12 weeks before launch, the same comparison as the Overview.
            Pick another range to see more history.
          </p>
        </div>

        {query.isPending ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-28" />
            <Skeleton className="h-80" />
          </div>
        ) : query.isError && !query.data ? (
          <QueryError
            error={query.error}
            fallback="Failed to load Google Analytics traffic"
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : query.data && !query.data.connected ? (
          <div className="max-w-2xl">
            <GoogleConnectionCard provider="ga4" projectId={projectId} />
          </div>
        ) : history && !view ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Google Analytics has no traffic recorded for this channel view yet.
          </p>
        ) : history && view ? (
          <>
            <TrafficControls
              search={search}
              coverage={view.coverage}
              onSearchChange={onSearchChange}
            />
            <p className="text-sm text-muted-foreground">
              {CHANNEL_LABELS[channel]} · {RANGE_LABELS[range]}:{" "}
              {formatDay(view.selected.start)} to {formatDay(view.selected.end)}
              . Data available {formatDay(view.coverage.start)} to{" "}
              {formatDay(view.coverage.end)} ({history.propertyTimeZone}).
              {query.isFetching ? " Refreshing..." : ""}
            </p>
            {history.truncated ? (
              <p className="text-sm text-destructive">
                History was cut off at the request cap, so the earliest days may
                be missing.
              </p>
            ) : null}
            <TrafficKpiCards
              post={search.compare === "yoy" ? view.weeklyPost : view.post}
              baseline={view.baseline}
              yoy={view.yoy}
              compare={search.compare}
              onCompareChange={(compare) => onSearchChange({ compare })}
            />
            <div className="rounded-xl border border-border bg-card p-4">
              <TrafficChart
                buckets={view.buckets}
                metric={metric}
                granularity={granularity}
                launch={launch}
                launchKey={view.launchKey}
                baselineValue={
                  view.baselineBucket
                    ? view.baselineBucket.averages[metricField(metric)]
                    : null
                }
                straddleKey={view.straddleKey}
                baselineNote={
                  isComparableAcrossLaunch(metric)
                    ? undefined
                    : KEY_EVENTS_NOT_COMPARABLE
                }
              />
              {view.partialOmitted > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {view.partialOmitted} partial {granularity} at the edge of the
                  data {view.partialOmitted === 1 ? "is" : "are"} hidden.
                </p>
              ) : null}
            </div>
            <TrafficTable
              rows={view.rows}
              granularity={granularity}
              metric={metric}
              hasBaseline={view.baselineBucket !== null}
              baselineSpan={view.baselineSpan}
              filename={`traffic-${channel}-${granularity}-${view.selected.start}-to-${view.selected.end}.csv`}
            />
            <p className="text-xs text-muted-foreground">
              Users are daily active users added up per period, so a person who
              visits on several days is counted more than once. Weeks run Monday
              to Sunday. Weeks and months that start or end outside the
              available data are partial and never used in averages. Source:
              Google Analytics, property{" "}
              {history.propertyDisplayName ?? "connected property"}.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
