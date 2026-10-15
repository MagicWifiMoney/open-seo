import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrow, Monitor, Smartphone } from "lucide-react";
import { getRankCompetitorMatrix } from "@/serverFunctions/rank-tracking";
import type { RankCompetitorMatrix } from "@/serverFunctions/rank-tracking";
import { QueryState } from "@/client/components/QueryState";
import { SkeletonCard } from "@/client/components/SkeletonPresets";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { EmptyState } from "@/client/components/EmptyState";
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
import {
  countCompetitorsAhead,
  positionBucket,
  sortCompetitorRows,
  type PositionBucket,
} from "./RankTrackingCompetitorGrid.logic";

type MatrixCell = RankCompetitorMatrix["rows"][number]["target"];

const BUCKET_CLASS: Record<PositionBucket, string> = {
  top3: "bg-success/20 text-success",
  top10: "bg-info/15 text-info",
  top20: "bg-warning/20 text-warning",
  deeper: "bg-muted text-muted-foreground",
  unseen: "text-muted-foreground",
};

/**
 * Miller-vs-competitors grid: keyword rows, one column for the tracked domain
 * and one per saved competitor. Positions come from the same SERP responses as
 * the domain's own checks, so each cell is the latest run's organic position.
 */
export function RankTrackingCompetitorGrid({
  projectId,
  configId,
  domain,
  devices,
}: {
  projectId: string;
  configId: string;
  domain: string;
  devices: "both" | "desktop" | "mobile";
}) {
  const [pickedDevice, setPickedDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const device = devices === "both" ? pickedDevice : devices;
  const query = useQuery({
    queryKey: ["rankCompetitorMatrix", projectId, configId, device],
    queryFn: () =>
      getRankCompetitorMatrix({ data: { projectId, configId, device } }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Competitor rankings</h3>
        {devices === "both" && (
          <SegmentedToggle
            items={[
              {
                value: "desktop" as const,
                icon: <Monitor className="size-3.5" />,
                label: "Desktop",
              },
              {
                value: "mobile" as const,
                icon: <Smartphone className="size-3.5" />,
                label: "Mobile",
              },
            ]}
            value={device}
            onChange={setPickedDevice}
          />
        )}
      </div>
      <QueryState
        query={query}
        errorFallback="Failed to load competitor rankings"
        loading={<SkeletonCard />}
      >
        {(matrix) => <CompetitorTable matrix={matrix} domain={domain} />}
      </QueryState>
    </div>
  );
}

function CompetitorTable({
  matrix,
  domain,
}: {
  matrix: RankCompetitorMatrix;
  domain: string;
}) {
  const [sortBy, setSortBy] = useState<"keyword" | "competitorsAhead">(
    "competitorsAhead",
  );
  const rows = useMemo(
    () => sortCompetitorRows(matrix.rows, sortBy),
    [matrix.rows, sortBy],
  );
  const behindCount = useMemo(
    () => matrix.rows.filter((row) => countCompetitorsAhead(row) > 0).length,
    [matrix.rows],
  );

  if (matrix.competitors.length === 0 || matrix.latestCheckedAt === null) {
    return (
      <EmptyState
        kind="no-data"
        title="No competitor rankings yet"
        description="Add competitors to the project and turn on Track competitors in the tracker settings, then run a check. Tracking competitors can raise the cost of a check, so review the estimate first."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          A competitor ranks above {domain} on{" "}
          <span className="font-semibold text-foreground">{behindCount}</span>{" "}
          of {matrix.rows.length} keywords
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={sortBy === "competitorsAhead"}
          onClick={() =>
            setSortBy((s) =>
              s === "competitorsAhead" ? "keyword" : "competitorsAhead",
            )
          }
        >
          <ArrowDownWideNarrow className="size-3.5" />
          {sortBy === "competitorsAhead"
            ? "Sorted by competitors ahead"
            : "Sort by competitors ahead"}
        </Button>
      </div>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 w-full bg-card">
                Keyword
              </TableHead>
              <TableHead className="text-right">{domain}</TableHead>
              {matrix.competitors.map((competitor) => (
                <TableHead key={competitor} className="text-right">
                  {competitor}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.trackingKeywordId}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">
                  {row.keyword}
                </TableCell>
                <TableCell className="text-right">
                  <PositionCell cell={row.target} />
                </TableCell>
                {matrix.competitors.map((competitor) => (
                  <TableCell key={competitor} className="text-right">
                    <PositionCell
                      cell={row.competitorCells[competitor]}
                      beatsTarget={
                        row.competitorCells[competitor].position !== null &&
                        (row.target.position === null ||
                          row.competitorCells[competitor].position <
                            row.target.position)
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}

function PositionCell({
  cell,
  beatsTarget = false,
}: {
  cell: MatrixCell;
  beatsTarget?: boolean;
}) {
  const bucket = positionBucket(cell.position);
  if (cell.position === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  // Only show a change when both checks saw the domain, like the history matrix.
  const change =
    cell.previousPosition !== null ? cell.previousPosition - cell.position : 0;
  return (
    <span className="inline-flex items-center justify-end gap-1 font-mono text-xs">
      <span
        className={`rounded px-1.5 py-0.5 ${BUCKET_CLASS[bucket]} ${beatsTarget ? "ring-1 ring-warning" : ""}`}
      >
        {cell.position}
      </span>
      {change > 0 && <span className="text-success">▲{change}</span>}
      {change < 0 && <span className="text-warning">▼{-change}</span>}
    </span>
  );
}
