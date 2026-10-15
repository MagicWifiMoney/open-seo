import { Area, AreaChart, ReferenceLine } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import type {
  TrafficGranularity,
  TrafficMetric,
} from "@/types/schemas/traffic";
import {
  formatAverage,
  formatBucketLabel,
  formatDay,
  formatNumber,
  METRIC_LABELS,
} from "./trafficFormat";
import { metricField, type Bucket } from "./trafficMath";

export function TrafficChart({
  buckets,
  metric,
  granularity,
  launch,
  launchKey,
  baselineValue,
}: {
  buckets: Bucket[];
  metric: TrafficMetric;
  granularity: TrafficGranularity;
  launch: string;
  /** Bucket key (start date) that contains the launch; null if out of range. */
  launchKey: string | null;
  /** Pre-launch average for one bucket of this size; null if unavailable. */
  baselineValue: number | null;
}) {
  const field = metricField(metric);
  const config = {
    value: { label: METRIC_LABELS[metric], color: "var(--color-primary)" },
  } satisfies ChartConfig;
  const data = buckets.map((bucket) => ({
    key: bucket.start,
    value: bucket[field],
  }));
  const unit = granularity === "day" ? "day" : granularity;

  return (
    <div className="space-y-2">
      <ChartContainer config={config} className="h-64 w-full sm:h-80">
        <AreaChart
          data={data}
          margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
        >
          <ChartGrid />
          <ChartXAxis
            dataKey="key"
            tickFormatter={(value: string) =>
              formatBucketLabel(value, granularity)
            }
          />
          <ChartYAxis
            domain={[0, "auto"]}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label: unknown) =>
                  typeof label === "string"
                    ? granularity === "day"
                      ? formatDay(label)
                      : formatBucketLabel(label, granularity)
                    : ""
                }
                valueFormatter={(value) => formatNumber(Number(value))}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="var(--color-value)"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          {baselineValue !== null ? (
            <ReferenceLine
              y={baselineValue}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="6 4"
              label={{
                value: `Pre-launch avg ${formatAverage(baselineValue)} / ${unit}`,
                position: "insideTopLeft",
                fontSize: 11,
                fill: "var(--color-muted-foreground)",
              }}
            />
          ) : null}
          {launchKey ? (
            <ReferenceLine
              x={launchKey}
              stroke="var(--color-destructive)"
              strokeWidth={1.5}
              label={{
                value: `Launch ${formatDay(launch)}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--color-destructive)",
              }}
            />
          ) : null}
        </AreaChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        {launchKey
          ? `Vertical line: site launch (${formatDay(launch)}).`
          : `Site launch (${formatDay(launch)}) is outside this range.`}{" "}
        {baselineValue !== null
          ? `Dashed line: pre-launch average per ${unit}, from complete ${granularity === "month" ? "months" : "weeks"} only.`
          : "No complete pre-launch period, so no baseline line."}
      </p>
    </div>
  );
}
