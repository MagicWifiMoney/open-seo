import type { RankCompetitorMatrix } from "@/serverFunctions/rank-tracking";

type MatrixRow = RankCompetitorMatrix["rows"][number];

/** Competitors ranking above the target for a keyword (a seen competitor beats an unseen target). */
export function countCompetitorsAhead(row: MatrixRow): number {
  const mine = row.target.position;
  return Object.values(row.competitorCells).filter(
    (cell) => cell.position !== null && (mine === null || cell.position < mine),
  ).length;
}

export function sortCompetitorRows(
  rows: MatrixRow[],
  sortBy: "keyword" | "competitorsAhead",
): MatrixRow[] {
  // oxlint-disable-next-line unicorn/no-array-sort -- copy is sorted; tsconfig lib lacks toSorted
  return [...rows].sort((a, b) => {
    if (sortBy === "competitorsAhead") {
      const diff = countCompetitorsAhead(b) - countCompetitorsAhead(a);
      if (diff !== 0) return diff;
    }
    return a.keyword.localeCompare(b.keyword);
  });
}

export type PositionBucket = "top3" | "top10" | "top20" | "deeper" | "unseen";

export function positionBucket(position: number | null): PositionBucket {
  if (position === null) return "unseen";
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  if (position <= 20) return "top20";
  return "deeper";
}
