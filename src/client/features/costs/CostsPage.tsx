import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { downloadFile } from "@/client/lib/download";
import { listProjectCosts } from "@/serverFunctions/costs";
import { CostsChart } from "./CostsChart";
import { CostsKpiRow } from "./CostsKpiRow";
import { CostsLookupsTable } from "./CostsLookupsTable";
import { CostsRunsTable } from "./CostsRunsTable";
import {
  COST_RANGES,
  COST_RANGE_LABELS,
  formatUsd,
  rangeWindow,
  sourceLabel,
  toCsv,
  type CostRange,
} from "./costsFormat";
import type { ProjectCostsResponse } from "@/types/schemas/costs";

function CostsSkeleton() {
  return (
    <div className="space-y-4" aria-busy role="status">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72 min-h-[220px]" />
      <Skeleton className="h-48" />
    </div>
  );
}

function exportCsv(data: ProjectCostsResponse) {
  const runs = toCsv(
    [
      "started_at",
      "type",
      "source",
      "requested",
      "got",
      "status",
      "cost_usd",
      "cost_status",
    ],
    data.runs.map((r) => [
      r.startedAt,
      r.runKind,
      r.source,
      r.requested,
      r.got,
      r.status,
      r.costUsd,
      r.costStatus,
    ]),
  );
  const lookups = toCsv(
    [
      "occurred_at",
      "source",
      "operation",
      "request",
      "results",
      "cost_usd",
      "status",
    ],
    data.lookups.map((l) => [
      l.occurredAt,
      sourceLabel(l.source),
      l.operation,
      l.requestSummary ?? "",
      l.resultCount,
      l.costUsd,
      l.status,
    ]),
  );
  downloadFile(runs, "costs-runs.csv", "text/csv");
  downloadFile(lookups, "costs-lookups.csv", "text/csv");
}

export function CostsPage({ projectId }: { projectId: string }) {
  const [range, setRange] = useState<CostRange>("30d");
  const query = useQuery({
    queryKey: ["projectCosts", projectId, range],
    queryFn: () =>
      listProjectCosts({ data: { projectId, ...rangeWindow(range) } }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Costs"
          description={
            <>
              <p>Every API call this project makes, at provider cost.</p>
              {data?.ledgerSince ? (
                <p className="mt-1 text-xs">
                  Actual costs recorded since {data.ledgerSince}; earlier runs
                  are estimates.
                </p>
              ) : null}
            </>
          }
          actions={
            <>
              {data && data.balanceUsd !== null ? (
                <Badge variant="outline">
                  Provider balance {formatUsd(data.balanceUsd)}
                </Badge>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!data}
                onClick={() => data && exportCsv(data)}
              >
                <Download />
                Export CSV
              </Button>
            </>
          }
        />
        <div
          role="group"
          aria-label="Date range"
          className="flex flex-wrap gap-1.5 print:hidden"
        >
          {COST_RANGES.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={option === range ? "secondary" : "outline"}
              aria-pressed={option === range}
              onClick={() => setRange(option)}
            >
              {COST_RANGE_LABELS[option]}
            </Button>
          ))}
        </div>

        {query.isPending ? (
          <CostsSkeleton />
        ) : !data ? (
          <QueryError
            error={query.error}
            fallback="Failed to load costs"
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : (
          <>
            <CostsKpiRow data={data} />
            <CostsChart days={data.days} />
            <CostsRunsTable runs={data.runs} projectId={projectId} />
            <CostsLookupsTable lookups={data.lookups} />
          </>
        )}
      </div>
    </div>
  );
}
