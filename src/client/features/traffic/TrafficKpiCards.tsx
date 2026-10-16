import { CardShell } from "@/client/components/CardShell";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import {
  TRAFFIC_COMPARES,
  TRAFFIC_METRICS,
  type TrafficCompare,
  type TrafficMetric,
} from "@/types/schemas/traffic";
import {
  formatAverage,
  formatDay,
  formatPercent,
  formatSigned,
  COMPARE_LABELS,
  KEY_EVENT_TRACKING_NOTE,
  METRIC_LABELS,
} from "./trafficFormat";
import {
  compareAverages,
  metricField,
  showReferenceSpan,
  type AveragedPeriod,
} from "./trafficMath";

function spanText(period: AveragedPeriod, unit: string): string {
  const length = period.days
    ? `${period.days} days`
    : `${period.periods} complete ${unit}${period.periods === 1 ? "" : "s"}`;
  return `${formatDay(period.start)} to ${formatDay(period.end)} (${length})`;
}

/** Key events are left off the top row: tracking changed at launch. */
const KPI_METRICS = TRAFFIC_METRICS.filter((metric) => metric !== "key_events");

export function TrafficKpiCards({
  post,
  baseline,
  yoy,
  compare,
  onCompareChange,
}: {
  post: AveragedPeriod | null;
  baseline: AveragedPeriod | null;
  yoy: AveragedPeriod | null;
  compare: TrafficCompare;
  onCompareChange: (compare: TrafficCompare) => void;
}) {
  const reference = compare === "baseline" ? baseline : yoy;
  const comparisons =
    post && reference
      ? compareAverages(post.averages, reference.averages)
      : null;
  const referenceName =
    compare === "baseline" ? "12 weeks before launch" : "Same weeks last year";

  return (
    <section className="space-y-3" aria-label="Post-launch averages per week">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">
            Average per week since launch
          </h2>
          <p className="text-sm text-muted-foreground">
            {compare === "baseline"
              ? "Launch day to the latest data day, against the 12 weeks before launch. Both are shown per week, the same comparison as the Overview."
              : "Complete Monday to Sunday weeks only, so a partial week never skews the average."}
          </p>
        </div>
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[compare]}
          className="print:hidden"
          aria-label="Comparison"
          onValueChange={(next) => {
            const match = TRAFFIC_COMPARES.find((option) => option === next[0]);
            if (match) onCompareChange(match);
          }}
        >
          {TRAFFIC_COMPARES.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {COMPARE_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {!post ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No complete week has passed since launch yet, so there is no
          post-launch average to show.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {KPI_METRICS.map((metric: TrafficMetric) => {
            const comparison = comparisons?.[metric];
            const percent = comparison?.delta.percent ?? null;
            return (
              <CardShell key={metric} title={METRIC_LABELS[metric]}>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatAverage(post.averages[metricField(metric)])}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / week
                  </span>
                </p>
                {comparison ? (
                  <p
                    className={`mt-1 text-sm font-medium tabular-nums ${
                      comparison.delta.absolute > 0
                        ? "text-success"
                        : comparison.delta.absolute < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {formatSigned(comparison.delta.absolute)} / week (
                    {formatPercent(percent)}) vs{" "}
                    {formatDay(reference?.start ?? "")} to{" "}
                    {formatDay(reference?.end ?? "")}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {compare === "yoy"
                      ? "No data for the same weeks last year."
                      : "No complete pre-launch weeks."}
                  </p>
                )}
                {comparison ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {referenceName}: {formatAverage(comparison.base)} / week
                  </p>
                ) : null}
                <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div>
                    <dt className="inline font-medium">Post-launch: </dt>
                    <dd className="inline">{spanText(post, "week")}</dd>
                  </div>
                  {reference && showReferenceSpan(metric, true) ? (
                    <div>
                      <dt className="inline font-medium">{referenceName}: </dt>
                      <dd className="inline">{spanText(reference, "week")}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardShell>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {KEY_EVENT_TRACKING_NOTE} Key events stay in the table below.
      </p>
      {compare === "yoy" ? (
        <p className="text-xs text-muted-foreground">
          Seasonality check: the same Monday to Sunday weeks one year earlier
          (364 days back), so weekdays line up.
        </p>
      ) : null}
    </section>
  );
}
