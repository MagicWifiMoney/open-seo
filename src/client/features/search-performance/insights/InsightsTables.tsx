import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus } from "lucide-react";
import { sort as sort_ } from "remeda";
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
import { useSaveKeywords } from "@/client/features/search-performance/SearchPerformanceParts";
import type { InsightsRow } from "@/types/schemas/gsc-insights";
import {
  describeDelta,
  formatCtr,
  formatInt,
  formatPosition,
  toneClass,
} from "./insightsFormat";

type SortKey = "clicks" | "impressions" | "ctr" | "position" | "clicksDelta";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "clicks", label: "Clicks" },
  { key: "impressions", label: "Impr." },
  { key: "ctr", label: "CTR" },
  { key: "position", label: "Pos." },
  { key: "clicksDelta", label: "Change" },
];

function SortHead({
  column,
  sort,
  onSort,
}: {
  column: { key: SortKey; label: string };
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  const Icon = sort.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead
      className="text-right"
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
        onClick={() => onSort(column.key)}
      >
        {column.label}
        {active ? <Icon className="size-3" aria-hidden /> : null}
      </button>
    </TableHead>
  );
}

function Prior({ children }: { children: string }) {
  return (
    <span className="block text-xs text-muted-foreground/70">{children}</span>
  );
}

export function InsightsTable({
  title,
  keyLabel,
  rows,
  projectId,
  hasCompare,
}: {
  title: string;
  keyLabel: string;
  rows: InsightsRow[];
  /** When set, rows get a Save keywords action (query tables only). */
  projectId?: string;
  hasCompare: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "clicks",
    desc: true,
  });
  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return sort_(rows, (a, b) => direction * (a[sort.key] - b[sort.key]));
  }, [rows, sort]);
  const save = useSaveKeywords(projectId ?? "");
  const onSort = (key: SortKey) =>
    setSort((current) => ({
      key,
      // Position reads best ascending (rank 1 first); everything else descending.
      desc: current.key === key ? !current.desc : key !== "position",
    }));

  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{keyLabel}</TableHead>
              {COLUMNS.map((column) => (
                <SortHead
                  key={column.key}
                  column={column}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
              {projectId ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const change = describeDelta("count", {
                absolute: row.clicksDelta,
                percent:
                  row.prevClicks === 0
                    ? null
                    : (row.clicksDelta / row.prevClicks) * 100,
              });
              return (
                <TableRow key={row.key}>
                  <TableCell className="max-w-xs break-words">
                    {row.key}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInt(row.clicks)}
                    {hasCompare ? (
                      <Prior>{formatInt(row.prevClicks)}</Prior>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInt(row.impressions)}
                    {hasCompare ? (
                      <Prior>{formatInt(row.prevImpressions)}</Prior>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCtr(row.ctr)}
                    {hasCompare ? (
                      <Prior>
                        {formatCtr(
                          row.prevImpressions > 0
                            ? row.prevClicks / row.prevImpressions
                            : 0,
                        )}
                      </Prior>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPosition(row.position)}
                    {hasCompare ? (
                      <Prior>{formatPosition(row.prevPosition)}</Prior>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${toneClass[change.tone]}`}
                  >
                    {hasCompare ? change.text : "-"}
                  </TableCell>
                  {projectId ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title="Save keyword"
                        aria-label={`Save keyword ${row.key}`}
                        disabled={save.isPending}
                        onClick={() => save.mutate([row.key])}
                      >
                        <BookmarkPlus />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>
      {hasCompare ? (
        <p className="text-xs text-muted-foreground">
          Grey values are from the comparison period.
        </p>
      ) : null}
    </section>
  );
}
