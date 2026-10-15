import { Link } from "@tanstack/react-router";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { TrafficChart } from "@/client/features/traffic/TrafficChart";
import {
  baselineForGranularity,
  launchBucketKey,
  visibleBuckets,
  type DateSpan,
  type DayPoint,
} from "@/client/features/traffic/trafficMath";
import { formatDay } from "@/client/features/traffic/trafficFormat";

/** Windows up to this many days chart by day, longer ones by week. */
const DAILY_MAX_DAYS = 60;

export function OverviewTrend({
  projectId,
  days,
  coverage,
  window,
  launch,
  markerHidden,
  spanDays,
}: {
  projectId: string;
  days: DayPoint[];
  coverage: DateSpan;
  window: DateSpan;
  launch: string;
  markerHidden: boolean;
  spanDays: number;
}) {
  const granularity = spanDays <= DAILY_MAX_DAYS ? "day" : "week";
  const { buckets } = visibleBuckets(days, granularity, coverage, window);
  const baseline = baselineForGranularity(days, granularity, coverage, launch);
  return (
    <CardShell
      title="Organic traffic trend"
      action={
        <Button
          variant="outline"
          size="sm"
          className="print:hidden"
          render={
            <Link
              to="/p/$projectId/traffic"
              params={{ projectId }}
              search={{ launch }}
            />
          }
        >
          Open Traffic tab
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Source: Google Analytics, organic search visits per {granularity},{" "}
          {formatDay(window.start)} to {formatDay(window.end)}. The dashed
          baseline is the average before launch.
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">What this means: </span>
          Each point is how many visits came from unpaid search in that{" "}
          {granularity}. A line above the dashed baseline means more visits than
          the usual pre-launch {granularity}.
        </p>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No complete {granularity} of Google Analytics data in this window.
          </p>
        ) : (
          <TrafficChart
            buckets={buckets}
            metric="sessions"
            granularity={granularity}
            launch={launch}
            launchKey={launchBucketKey(launch, granularity, buckets)}
            baselineValue={baseline ? baseline.averages.sessions : null}
            markerHidden={markerHidden}
          />
        )}
      </div>
    </CardShell>
  );
}
