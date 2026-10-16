import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { QueryError } from "@/client/components/QueryState";
import { Skeleton } from "@/client/components/ui/skeleton";
import { downloadFile } from "@/client/lib/download";
import { getGscInsights } from "@/serverFunctions/gscInsights";
import type {
  GscInsightsCompare,
  GscInsightsDevice,
  GscInsightsRange,
} from "@/types/schemas/gsc-insights";
import { InsightsBreakdowns } from "./InsightsBreakdowns";
import { InsightsControls } from "./InsightsControls";
import { InsightsKpiRow } from "./InsightsKpiRow";
import { InsightsMovers } from "./InsightsMovers";
import { InsightsTable } from "./InsightsTables";
import { InsightsTrendChart } from "./InsightsTrendChart";
import { dailyCsv, formatDate } from "./insightsFormat";

function InsightsSkeleton() {
  return (
    <div className="space-y-4" aria-busy role="status">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72 min-h-[220px]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

/**
 * The stored-history half of the Search Performance page. Rows below it (the
 * live Search Console tables) arrive as children and sit under a "More detail"
 * heading once insights are showing; with no stored history yet the page keeps
 * its original layout and shows only a short note.
 */
export function GscInsightsSection({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [range, setRange] = useState<GscInsightsRange>("3m");
  const [compare, setCompare] = useState<GscInsightsCompare>("previous_period");
  const [device, setDevice] = useState<GscInsightsDevice>("all");

  const query = useQuery({
    queryKey: ["gscInsights", projectId, range, compare, device],
    queryFn: () =>
      getGscInsights({ data: { projectId, range, compare, device } }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  if (query.isPending) {
    return (
      <>
        <InsightsSkeleton />
        {children}
      </>
    );
  }
  if (!data) {
    return (
      <>
        <QueryError
          error={query.error}
          fallback="Failed to load Search Console history"
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
        {children}
      </>
    );
  }
  if (data.coverage === null) {
    return (
      <>
        <div
          className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          History is still being collected, check back after the morning
          refresh.
        </div>
        {children}
      </>
    );
  }

  const hasCompare = data.compareWindow !== null;
  const compareLabel = data.compareWindow
    ? `vs ${formatDate(data.compareWindow.start)} to ${formatDate(data.compareWindow.end)}`
    : "";
  const refreshing = query.isPlaceholderData;

  return (
    <>
      <div className="space-y-4">
        <InsightsControls
          range={range}
          compare={compare}
          device={device}
          onRangeChange={setRange}
          onCompareChange={setCompare}
          onDeviceChange={setDevice}
          coverage={data.coverage}
          onExport={() =>
            downloadFile(
              dailyCsv(data.daily, data.compareDaily),
              `search-console-${data.window.start}-to-${data.window.end}.csv`,
              "text/csv",
            )
          }
        />
        {query.isError ? (
          <QueryError
            error={query.error}
            fallback="Failed to refresh Search Console history"
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : null}
        <div
          className={
            refreshing ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"
          }
          aria-busy={refreshing}
        >
          <InsightsKpiRow
            totals={data.totals}
            deltas={data.deltas}
            compareLabel={compareLabel}
            noCompareData={
              compare !== "none" && data.compareCoverage !== "full"
            }
          />
          <InsightsTrendChart
            daily={data.daily}
            compareDaily={data.compareDaily}
          />
          <InsightsBreakdowns
            positionBuckets={data.positionBuckets}
            deviceSplit={data.deviceSplit}
          />
          {hasCompare ? (
            <InsightsMovers
              gainers={data.movers.gainers}
              losers={data.movers.losers}
            />
          ) : null}
          <InsightsTable
            title="Top queries"
            keyLabel="Query"
            rows={data.topQueries}
            projectId={projectId}
            hasCompare={hasCompare}
          />
          <InsightsTable
            title="Top pages"
            keyLabel="Page"
            rows={data.topPages}
            hasCompare={hasCompare}
          />
        </div>
      </div>
      <h2 className="pt-4 text-lg font-semibold">More detail</h2>
      {children}
    </>
  );
}
