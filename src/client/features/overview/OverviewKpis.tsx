import { Card } from "@/client/components/ui/card";
import { formatNumber } from "@/client/features/traffic/trafficFormat";
import { KPI_COPY } from "./overviewCopy";
import type { Kpi, KpiKey } from "./overviewMetrics";
import { deltaChip, sparklinePoints, type Tone } from "./overviewWidgets";

export type KpiCardData = {
  kpi: Kpi;
  /** Printed windows under the number, on one line. */
  currentLabel: string;
  compareLabel: string;
  /** Shown instead of a delta when the number cannot be read. */
  note?: string;
  /** Daily-ish values across the current window; absent when the source has no series. */
  series?: number[] | null;
};

function formatValue(key: KpiKey, value: number): string {
  return key === "position" ? value.toFixed(1) : formatNumber(value);
}

const TONE_CLASS = {
  good: "bg-success/10 text-success",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

const ARROW = { up: "\u2191", down: "\u2193", flat: "\u2192" } as const;

function Sparkline({ series, tone }: { series: number[]; tone: Tone }) {
  return (
    <svg
      viewBox="0 0 120 32"
      preserveAspectRatio="none"
      className={`h-8 w-24 shrink-0 ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-success" : "text-muted-foreground"}`}
      role="img"
      aria-label={`Trend across the window, ${series.length} points`}
    >
      <polyline
        points={sparklinePoints(series, 120, 32)}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function KpiCard({ data }: { data: KpiCardData }) {
  const { kpi } = data;
  const copy = KPI_COPY[kpi.key];
  const chip = deltaChip(kpi);
  const tone: Tone = chip?.tone ?? "neutral";
  return (
    <Card size="sm" className="gap-2 p-4 print:break-inside-avoid">
      <h3 className="text-sm font-semibold">{copy.label}</h3>
      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 text-4xl font-semibold tabular-nums">
          {kpi.current === null ? "n/a" : formatValue(kpi.key, kpi.current)}
        </p>
        {data.series ? <Sparkline series={data.series} tone={tone} /> : null}
      </div>
      {data.note ? (
        <p className="text-sm font-medium text-muted-foreground">{data.note}</p>
      ) : chip ? (
        <p>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium tabular-nums ${TONE_CLASS[chip.tone]}`}
          >
            <span aria-hidden>{ARROW[chip.arrow]}</span>
            {chip.text}
          </span>
        </p>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">
          No comparison available
        </p>
      )}
      <p className="break-words text-xs text-muted-foreground">
        {data.currentLabel} vs {data.compareLabel}, source {copy.short}
      </p>
      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer select-none print:hidden">
          What this means
        </summary>
        <p className="mt-1">{copy.meaning}</p>
      </details>
    </Card>
  );
}

/** Outcomes first: key events lead, then visits and clicks, then the reach
 *  numbers. Cards for a source that is not connected are replaced by the
 *  connect card by the caller. */
export function OverviewKpis({ cards }: { cards: KpiCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((data) => (
        <KpiCard key={data.kpi.key} data={data} />
      ))}
    </div>
  );
}
