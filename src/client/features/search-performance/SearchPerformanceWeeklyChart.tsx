import { Area, AreaChart, ReferenceArea, ReferenceLine } from "recharts";
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
import { KPI_COPY } from "@/client/features/overview/overviewCopy";
import {
  formatBucketLabel,
  formatDay,
} from "@/client/features/traffic/trafficFormat";
import {
  buildWeeklySeries,
  type DailySearchPoint,
} from "./searchPerformanceWeekly";

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });
const full = new Intl.NumberFormat("en-US");

function WeeklyMetricChart({
  points,
  field,
  launchKey,
}: {
  points: ReturnType<typeof buildWeeklySeries>;
  field: "clicks" | "impressions";
  launchKey: string | null;
}) {
  const label = KPI_COPY[field].label;
  const config = {
    value: { label, color: "var(--color-primary)" },
  } satisfies ChartConfig;
  const data = points.map((point) => ({ key: point.key, value: point[field] }));
  const firstKey = points[0]?.key;
  const lastPreKey = points.filter((point) => point.preLaunch).at(-1)?.key;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{label}, per week</h3>
      <ChartContainer config={config} className="h-48 w-full">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
        >
          <ChartGrid />
          <ChartXAxis
            dataKey="key"
            tickFormatter={(value: string) => formatBucketLabel(value, "week")}
          />
          <ChartYAxis
            domain={[0, "auto"]}
            tickFormatter={(value: number) => compact.format(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(key: unknown) => {
                  if (typeof key !== "string") return "";
                  const straddles = points.find(
                    (point) => point.key === key,
                  )?.straddlesLaunch;
                  const text = formatBucketLabel(key, "week");
                  return straddles
                    ? `${text} (partly old site, not a before or after reading)`
                    : text;
                }}
                valueFormatter={(value) => full.format(Number(value))}
              />
            }
          />
          {firstKey && lastPreKey ? (
            <ReferenceArea
              x1={firstKey}
              x2={lastPreKey}
              fill="var(--color-muted-foreground)"
              fillOpacity={0.1}
              ifOverflow="visible"
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="var(--color-value)"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          {launchKey ? (
            <ReferenceLine
              x={launchKey}
              stroke="var(--color-destructive)"
              strokeWidth={1.5}
            />
          ) : null}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/** Weekly clicks and impressions from about 12 weeks before launch to now,
 *  with the launch week marked and the pre-launch weeks shaded. */
export function SearchPerformanceWeeklyChart({
  daily,
  launch,
  latest,
}: {
  daily: DailySearchPoint[];
  launch: string;
  latest: string;
}) {
  const points = buildWeeklySeries(daily, launch, latest);
  if (points.length === 0) return null;
  const launchKey =
    points.find((point) => point.straddlesLaunch || point.key >= launch)?.key ??
    null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <WeeklyMetricChart
          points={points}
          field="clicks"
          launchKey={launchKey}
        />
        <WeeklyMetricChart
          points={points}
          field="impressions"
          launchKey={launchKey}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Source: Google Search Console. Weeks run Monday to Sunday and the
        unfinished current week is left out. Red line: the week the site
        launched ({formatDay(launch)}). Shaded: the weeks before launch.
      </p>
    </div>
  );
}
