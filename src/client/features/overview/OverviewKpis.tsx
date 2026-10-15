import { Card } from "@/client/components/ui/card";
import {
  formatNumber,
  formatPercent,
} from "@/client/features/traffic/trafficFormat";
import { KPI_COPY } from "./overviewCopy";
import type { Kpi, KpiKey } from "./overviewMetrics";

export type KpiCardData = {
  kpi: Kpi;
  /** Printed windows under the number. */
  currentLabel: string;
  compareLabel: string;
  /** Shown instead of a delta when the number cannot be read. */
  note?: string;
};

function formatValue(key: KpiKey, value: number): string {
  return key === "position" ? value.toFixed(1) : formatNumber(value);
}

function deltaText(kpi: Kpi): string {
  if (kpi.current === null || kpi.base === null || kpi.absolute === null) {
    return "No comparison available";
  }
  const base = formatValue(kpi.key, kpi.base);
  if (kpi.trend === "flat") return `About the same as ${base}`;
  const way = kpi.trend === "up" ? "Up" : "Down";
  if (kpi.key === "position") {
    return `${way} ${Math.abs(kpi.absolute).toFixed(1)} places from ${base}`;
  }
  const small = kpi.base < 10 || kpi.percent === null;
  return small
    ? `${way} from ${base}`
    : `${way} ${formatPercent(Math.abs(kpi.percent ?? 0)).replace("+", "")} from ${base}`;
}

function KpiCard({ data }: { data: KpiCardData }) {
  const { kpi } = data;
  const copy = KPI_COPY[kpi.key];
  const tone =
    kpi.better === true
      ? "text-success"
      : kpi.better === false
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <Card size="sm" className="gap-2 p-4 print:break-inside-avoid">
      <div>
        <h3 className="text-sm font-semibold">{copy.label}</h3>
        <p className="text-xs text-muted-foreground">{copy.source}</p>
      </div>
      <p className="text-3xl font-semibold tabular-nums">
        {kpi.current === null ? "n/a" : formatValue(kpi.key, kpi.current)}
      </p>
      <p className={`text-sm font-medium ${tone}`}>
        {data.note ?? deltaText(kpi)}
      </p>
      <p className="text-xs text-muted-foreground">
        Now: {data.currentLabel}
        <br />
        Compared with: {data.compareLabel}
      </p>
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">What this means: </span>
        {copy.meaning}
      </p>
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
