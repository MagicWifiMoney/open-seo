import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { spanLabel } from "@/client/features/overview/overviewView";
import {
  formatCount,
  formatPosition,
  type Report,
} from "@/client/features/search-performance/SearchPerformanceColumns";

type Mover = Report["movers"][number];

function signedCount(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${formatCount(rounded)}`;
}

/** Position change: positive means the query moved up the results. */
function signedPosition(value: number | null): string {
  if (value === null) return "n/a";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function tone(value: number | null): string {
  if (value === null || Math.round(value * 10) === 0)
    return "text-muted-foreground";
  return value > 0 ? "text-success" : "text-destructive";
}

export function MoversTable({
  rows,
  range,
}: {
  rows: Mover[];
  range: Report["range"];
}) {
  const reference = spanLabel({
    start: range.prevStartDate,
    end: range.prevEndDate,
  });
  return (
    <div className="p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        Queries whose clicks or position changed most, comparing{" "}
        {spanLabel({ start: range.startDate, end: range.endDate })} with{" "}
        {range.baseline === "launch"
          ? `the 12 weeks before launch (${reference}), scaled to the same number of days`
          : `the previous period (${reference})`}
        . Position change is shown as places moved: plus means it moved up.
        Google lists only each period&apos;s top queries, so a query near the
        cutoff can read as new.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-full">Query</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Clicks before</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Position</TableHead>
            <TableHead className="text-right">Position before</TableHead>
            <TableHead className="text-right">Moved</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.query}>
              <TableCell>
                <span className="inline-flex max-w-xl items-center gap-2">
                  <span className="truncate" title={row.query}>
                    {row.query}
                  </span>
                  {row.isBrand ? <Badge size="sm">Brand</Badge> : null}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(row.clicks)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(row.prevClicks)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${tone(row.clickChange)}`}
              >
                {signedCount(row.clickChange)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.position === null ? "n/a" : formatPosition(row.position)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.prevPosition === null
                  ? "n/a"
                  : formatPosition(row.prevPosition)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${tone(row.positionChange)}`}
              >
                {signedPosition(row.positionChange)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No query moved between the two periods.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
