import { useState } from "react";
import { Badge } from "@/client/components/ui/badge";
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
import type { ProjectCostsResponse } from "@/types/schemas/costs";
import { formatDateTime, formatUsd, sourceLabel } from "./costsFormat";

const PAGE_SIZE = 50;

export function CostsLookupsTable({
  lookups,
}: {
  lookups: ProjectCostsResponse["lookups"];
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(lookups.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = lookups.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <section className="space-y-2" aria-label="Lookups">
      <h2 className="text-base font-semibold">Lookups</h2>
      {lookups.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No lookups in this window.
        </p>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Request</TableHead>
                <TableHead className="text-right">Results</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(row.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{sourceLabel(row.source)}</Badge>
                  </TableCell>
                  <TableCell>{row.operation}</TableCell>
                  <TableCell className="max-w-xs">
                    <span
                      className="block truncate"
                      title={row.requestSummary ?? undefined}
                    >
                      {row.requestSummary ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.resultCount ?? "-"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <span
                      className={
                        row.status === "estimated"
                          ? "text-muted-foreground"
                          : undefined
                      }
                    >
                      {formatUsd(row.costUsd)}
                      {row.status === "estimated" ? " est." : ""}
                    </span>
                    {row.status === "failed_charged" ? (
                      <Badge variant="destructive" size="sm" className="ml-2">
                        charged, failed
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-border p-2 text-sm">
              <span className="text-muted-foreground">
                Page {current + 1} of {pages}
              </span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </TableCard>
      )}
    </section>
  );
}
