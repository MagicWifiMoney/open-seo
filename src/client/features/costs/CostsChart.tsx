import { useMemo } from "react";
import { Bar, BarChart } from "recharts";
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
import type { ProjectCostsResponse } from "@/types/schemas/costs";
import { formatDay, formatUsd, sourceLabel } from "./costsFormat";

const COLORS = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function CostsChart({ days }: { days: ProjectCostsResponse["days"] }) {
  const { points, config, sources } = useMemo(() => {
    const sourceSet = new Set<string>();
    for (const day of days) {
      for (const source of Object.keys(day.bySource)) sourceSet.add(source);
    }
    const sourceList = [...sourceSet];
    const chartConfig: ChartConfig = {};
    sourceList.forEach((source, i) => {
      chartConfig[source] = {
        label: sourceLabel(source),
        color: COLORS[i % COLORS.length],
      };
    });
    return {
      points: days.map((day) => ({ date: day.date, ...day.bySource })),
      config: chartConfig,
      sources: sourceList,
    };
  }, [days]);

  return (
    <section
      aria-label="Daily spend by source"
      className="space-y-2 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-base font-semibold">Daily spend</h2>
      {days.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No spend recorded in this window.
        </p>
      ) : (
        <ChartContainer
          config={config}
          className="h-64 min-h-[220px] w-full sm:h-72"
        >
          <BarChart
            data={points}
            margin={{ top: 16, right: 4, bottom: 0, left: 0 }}
          >
            <ChartGrid />
            <ChartXAxis
              dataKey="date"
              tickFormatter={(value: string) => formatDay(value)}
            />
            <ChartYAxis
              domain={[0, "auto"]}
              tickFormatter={(value: number) => formatUsd(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label: unknown) =>
                    typeof label === "string" ? formatDay(label) : ""
                  }
                  valueFormatter={(value) => formatUsd(Number(value))}
                />
              }
            />
            {sources.map((source) => (
              <Bar
                key={source}
                dataKey={source}
                stackId="spend"
                fill={`var(--color-${source})`}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
}
