import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { sort as sort_ } from "remeda";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/client/components/ui/badge";
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
import { formatDateTime, formatUsd } from "./costsFormat";

type Run = ProjectCostsResponse["runs"][number];
type SortKey = "date" | "cost";

const TYPE_LABELS: Record<Run["runKind"], string> = {
  rank_check_run: "Rank check",
  ai_run: "AI visibility",
  audit: "Site audit",
};

function RunLink({
  run,
  projectId,
  children,
}: {
  run: Run;
  projectId: string;
  children: React.ReactNode;
}) {
  const className = "block hover:underline";
  if (run.runKind === "rank_check_run") {
    return (
      <Link
        to="/p/$projectId/rank-tracking"
        params={{ projectId }}
        className={className}
      >
        {children}
      </Link>
    );
  }
  if (run.runKind === "ai_run") {
    return (
      <Link
        to="/p/$projectId/ai-visibility"
        params={{ projectId }}
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link to="/p/$projectId/audit" params={{ projectId }} className={className}>
      {children}
    </Link>
  );
}

export function RunCost({ run }: { run: Pick<Run, "costUsd" | "costStatus"> }) {
  const text = formatUsd(run.costUsd);
  if (run.costStatus === "estimated") {
    return <span className="text-muted-foreground">{text} est.</span>;
  }
  if (run.costStatus === "partial") {
    return <span className="text-muted-foreground">{text} so far</span>;
  }
  return <span>{text}</span>;
}

function SortHead({
  label,
  active,
  desc,
  onClick,
  right,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  right?: boolean;
}) {
  const Icon = desc ? ArrowDown : ArrowUp;
  return (
    <TableHead
      className={right ? "text-right" : undefined}
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
        onClick={onClick}
      >
        {label}
        {active ? <Icon className="size-3" aria-hidden /> : null}
      </button>
    </TableHead>
  );
}

export function CostsRunsTable({
  runs,
  projectId,
}: {
  runs: Run[];
  projectId: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "date",
    desc: true,
  });
  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    return sort_(runs, (a, b) =>
      sort.key === "cost"
        ? dir * (a.costUsd - b.costUsd)
        : dir * a.startedAt.localeCompare(b.startedAt),
    );
  }, [runs, sort]);
  const onSort = (key: SortKey) =>
    setSort((cur) => ({ key, desc: cur.key === key ? !cur.desc : true }));

  return (
    <section className="space-y-2" aria-label="Runs">
      <h2 className="text-base font-semibold">Runs</h2>
      {runs.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No runs in this window.
        </p>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead
                  label="Date"
                  active={sort.key === "date"}
                  desc={sort.desc}
                  onClick={() => onSort("date")}
                />
                <TableHead>Type</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Got</TableHead>
                <TableHead>Status</TableHead>
                <SortHead
                  label="Cost"
                  right
                  active={sort.key === "cost"}
                  desc={sort.desc}
                  onClick={() => onSort("cost")}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((run) => (
                <TableRow key={`${run.runKind}-${run.runId}`}>
                  <TableCell className="whitespace-nowrap">
                    <RunLink run={run} projectId={projectId}>
                      {formatDateTime(run.startedAt)}
                    </RunLink>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {TYPE_LABELS[run.runKind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs break-words">
                    {run.requested}
                  </TableCell>
                  <TableCell className="max-w-xs break-words">
                    {run.got}
                  </TableCell>
                  <TableCell>{run.status}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <RunCost run={run} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </section>
  );
}
