import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { KPI_COPY } from "@/client/features/overview/overviewCopy";
import { spanLabel } from "@/client/features/overview/overviewView";
import {
  formatCount,
  formatCtr,
  formatPosition,
  type Report,
} from "@/client/features/search-performance/SearchPerformanceColumns";

type Delta = { text: string; improved: boolean } | null;

function percentDelta(current: number, previous: number): Delta {
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  const pct = (change * 100).toFixed(1);
  return { text: `${change >= 0 ? "+" : ""}${pct}%`, improved: change >= 0 };
}

/** Position falls as rankings improve, so the delta is inverted. */
function positionDelta(current: number, previous: number): Delta {
  if (previous <= 0 || current <= 0) return null;
  const change = previous - current;
  return {
    text: `${change >= 0 ? "+" : ""}${change.toFixed(1)}`,
    improved: change >= 0,
  };
}

export function TotalsTable({ report }: { report: Report }) {
  const { totals, prevTotals, range, brand } = report;
  const current = spanLabel({ start: range.startDate, end: range.endDate });
  const reference = spanLabel({
    start: range.prevStartDate,
    end: range.prevEndDate,
  });
  const deltaTitle = `Compared with ${reference}`;
  const nonBrandClicks = Math.max(totals.clicks - brand.clicks, 0);
  const prevNonBrandClicks = Math.max(prevTotals.clicks - brand.prevClicks, 0);
  const clicksLabel = KPI_COPY.clicks.label;
  const metrics = [
    {
      label: clicksLabel,
      value: formatCount(totals.clicks),
      delta: percentDelta(totals.clicks, prevTotals.clicks),
    },
    {
      label: `${clicksLabel}, searches with "${brand.terms.join('" or "')}" (brand)`,
      value: formatCount(brand.clicks),
      delta: percentDelta(brand.clicks, brand.prevClicks),
    },
    {
      label: `${clicksLabel}, all other searches (non-brand)`,
      value: formatCount(nonBrandClicks),
      delta: percentDelta(nonBrandClicks, prevNonBrandClicks),
    },
    {
      label: KPI_COPY.impressions.label,
      value: formatCount(totals.impressions),
      delta: percentDelta(totals.impressions, prevTotals.impressions),
    },
    {
      label: "Click-through rate",
      value: formatCtr(totals.ctr),
      delta: percentDelta(totals.ctr, prevTotals.ctr),
    },
    {
      label: KPI_COPY.position.label,
      value: formatPosition(totals.position),
      delta: positionDelta(totals.position, prevTotals.position),
    },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        Source: {KPI_COPY.clicks.source}. {current}. Change is against{" "}
        {range.baseline === "launch"
          ? `the 12 weeks before launch (${reference}), scaled to the same number of days`
          : `the previous period (${reference})`}
        . Non-brand includes searches Google does not list by name.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-full">Metric</TableHead>
            <TableHead className="min-w-32 text-right">Value</TableHead>
            <TableHead
              className="min-w-40 text-right whitespace-nowrap"
              title={deltaTitle}
            >
              Change vs {reference}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map(({ label, value, delta }) => (
            <TableRow key={label}>
              <TableCell>{label}</TableCell>
              <TableCell className="text-right tabular-nums">{value}</TableCell>
              <TableCell
                className={`text-right tabular-nums ${delta ? (delta.improved ? "text-success" : "text-destructive") : "text-muted-foreground"}`}
                title={deltaTitle}
              >
                {delta?.text ?? "n/a"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
