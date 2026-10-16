import { CardShell } from "@/client/components/CardShell";
import type {
  InsightsTotals,
  InsightsTotalsWithDelta,
} from "@/types/schemas/gsc-insights";
import {
  describeDelta,
  formatCtr,
  formatInt,
  formatPosition,
  toneClass,
  type DeltaKind,
} from "./insightsFormat";

const KPIS: {
  key: keyof InsightsTotals;
  label: string;
  kind: DeltaKind;
  format: (value: number) => string;
}[] = [
  { key: "clicks", label: "Clicks", kind: "count", format: formatInt },
  {
    key: "impressions",
    label: "Impressions",
    kind: "count",
    format: formatInt,
  },
  { key: "ctr", label: "CTR", kind: "ctr", format: formatCtr },
  {
    key: "position",
    label: "Avg position",
    kind: "position",
    format: formatPosition,
  },
];

export function InsightsKpiRow({
  totals,
  deltas,
  compareLabel,
}: {
  totals: InsightsTotals;
  deltas: InsightsTotalsWithDelta | null;
  compareLabel: string;
}) {
  return (
    <section
      aria-label="Key metrics"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {KPIS.map((kpi) => {
        const view = describeDelta(kpi.kind, deltas ? deltas[kpi.key] : null);
        return (
          <CardShell key={kpi.key} title={kpi.label}>
            <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {kpi.format(totals[kpi.key])}
            </p>
            {deltas ? (
              <p
                data-testid={`delta-${kpi.key}`}
                data-tone={view.tone}
                className={`mt-1 text-sm font-medium tabular-nums ${toneClass[view.tone]}`}
              >
                {view.text}
                <span className="ml-1 font-normal text-muted-foreground">
                  {compareLabel}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No comparison
              </p>
            )}
          </CardShell>
        );
      })}
    </section>
  );
}
