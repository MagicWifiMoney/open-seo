import { useMemo, useState } from "react";
import { Area, ComposedChart, Line } from "recharts";
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
import { Button } from "@/client/components/ui/button";
import type { InsightsDailyRow } from "@/types/schemas/gsc-insights";
import {
  buildChartPoints,
  formatDate,
  formatInt,
  granularityFor,
} from "./insightsFormat";

const config = {
  clicks: { label: "Clicks", color: "var(--color-primary)" },
  impressions: { label: "Impressions", color: "var(--color-chart-2)" },
  prevClicks: { label: "Clicks (compare)", color: "var(--color-primary)" },
  prevImpressions: {
    label: "Impressions (compare)",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

function shortLabel(date: string, weekly: boolean): string {
  const [year, month, day] = date.split("-").map(Number);
  const text = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return weekly ? `Wk of ${text}` : text;
}

export function InsightsTrendChart({
  daily,
  compareDaily,
}: {
  daily: InsightsDailyRow[];
  compareDaily: InsightsDailyRow[];
}) {
  const [smooth, setSmooth] = useState(false);
  const granularity = granularityFor(daily.length);
  const weekly = granularity === "week";
  const points = useMemo(
    () =>
      buildChartPoints(daily, compareDaily, { granularity, rolling: smooth }),
    [daily, compareDaily, granularity, smooth],
  );
  const hasCompare = compareDaily.length > 0;

  return (
    <section
      aria-label="Clicks and impressions trend"
      className="space-y-2 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Clicks and impressions</h2>
        <Button
          type="button"
          size="sm"
          variant={smooth && !weekly ? "secondary" : "outline"}
          aria-pressed={smooth && !weekly}
          disabled={weekly}
          title={
            weekly
              ? "Weekly totals are already smoothed"
              : "Average each point with the 6 days before it"
          }
          onClick={() => setSmooth((current) => !current)}
        >
          7-day average
        </Button>
      </div>
      <ChartContainer
        config={config}
        className="h-64 min-h-[220px] w-full sm:h-80"
      >
        <ComposedChart
          data={points}
          margin={{ top: 16, right: 4, bottom: 0, left: 0 }}
        >
          <ChartGrid />
          <ChartXAxis
            dataKey="date"
            tickFormatter={(value: string) => shortLabel(value, weekly)}
          />
          <ChartYAxis
            yAxisId="clicks"
            domain={[0, "auto"]}
            tickFormatter={(value: number) => formatInt(value)}
          />
          <ChartYAxis
            yAxisId="impressions"
            orientation="right"
            domain={[0, "auto"]}
            tickFormatter={(value: number) => formatInt(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label: unknown) =>
                  typeof label === "string"
                    ? weekly
                      ? `Week of ${formatDate(label)}`
                      : formatDate(label)
                    : ""
                }
                valueFormatter={(value) => formatInt(Number(value))}
              />
            }
          />
          <Area
            yAxisId="clicks"
            type="monotone"
            dataKey="clicks"
            stroke="var(--color-clicks)"
            strokeWidth={2}
            fill="var(--color-clicks)"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          <Line
            yAxisId="impressions"
            type="monotone"
            dataKey="impressions"
            stroke="var(--color-impressions)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {hasCompare ? (
            <Line
              yAxisId="clicks"
              type="monotone"
              dataKey="prevClicks"
              stroke="var(--color-prevClicks)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.5}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          {hasCompare ? (
            <Line
              yAxisId="impressions"
              type="monotone"
              dataKey="prevImpressions"
              stroke="var(--color-prevImpressions)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeOpacity={0.5}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        Clicks use the left axis, impressions the right.
        {hasCompare ? " Dashed lines show the comparison period." : ""}
        {weekly ? " Ranges over three months are shown as weekly totals." : ""}
      </p>
    </section>
  );
}
