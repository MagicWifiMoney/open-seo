import { Download } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { downloadFile } from "@/client/lib/download";
import type {
  TrafficGranularity,
  TrafficMetric,
} from "@/types/schemas/traffic";
import {
  formatBucketLabel,
  formatDay,
  formatNumber,
  formatPercent,
  KEY_EVENTS_NOT_COMPARABLE,
  LAUNCH_WEEK_NOTE,
  METRIC_LABELS,
} from "./trafficFormat";
import { trafficCsv, type TrafficTableRow } from "./trafficCsv";

export function TrafficTable({
  rows,
  granularity,
  metric,
  hasBaseline,
  baselineSpan,
  filename,
}: {
  rows: TrafficTableRow[];
  granularity: TrafficGranularity;
  metric: TrafficMetric;
  hasBaseline: boolean;
  /** Printed dates of the periods the baseline averages. */
  baselineSpan?: string;
  filename: string;
}) {
  return (
    <TableCard>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Traffic by {granularity}</h2>
          <p className="text-xs text-muted-foreground">
            {hasBaseline
              ? `Change column compares ${METRIC_LABELS[metric].toLowerCase()} with the average ${granularity} in the 12 weeks before launch${baselineSpan ? ` (${baselineSpan})` : ""}.`
              : metric === "key_events"
                ? KEY_EVENTS_NOT_COMPARABLE
                : "No complete pre-launch period to compare with."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="print:hidden"
          disabled={rows.length === 0}
          onClick={() => downloadFile(trafficCsv(rows), filename, "text/csv")}
        >
          <Download data-icon="inline-start" />
          Download CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
            <TableHead className="text-right">Users</TableHead>
            <TableHead className="text-right">Key events</TableHead>
            <TableHead className="text-right">Vs baseline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows
            .map((_, index) => rows[rows.length - 1 - index])
            .map((row) => (
              <TableRow key={row.start}>
                <TableCell className="whitespace-nowrap">
                  {granularity === "day"
                    ? formatDay(row.start)
                    : `${formatBucketLabel(row.start, granularity)} (${row.start} to ${row.end})`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.sessions)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.users)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.keyEvents)}
                </TableCell>
                <TableCell
                  className="text-right tabular-nums"
                  title={row.partialOldSite ? LAUNCH_WEEK_NOTE : undefined}
                >
                  {row.partialOldSite
                    ? "Partial old-site week"
                    : hasBaseline
                      ? formatPercent(row.vsBaseline)
                      : "n/a"}
                </TableCell>
              </TableRow>
            ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No complete periods in this range.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableCard>
  );
}
