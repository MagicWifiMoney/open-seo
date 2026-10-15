import { buildCsv } from "@/client/lib/csv";
import { percentChange, type Bucket } from "./trafficMath";

export type TrafficTableRow = Bucket & {
  /** Percent change of the selected metric vs the pre-launch average. */
  vsBaseline: number | null;
};

export function buildTableRows(
  buckets: Bucket[],
  baseline: number | null,
  field: "sessions" | "users" | "keyEvents",
): TrafficTableRow[] {
  return buckets.map((bucket) => ({
    ...bucket,
    vsBaseline:
      baseline === null ? null : percentChange(bucket[field], baseline),
  }));
}

export function trafficCsv(rows: TrafficTableRow[]): string {
  return buildCsv(
    [
      "Period start",
      "Period end",
      "Sessions",
      "Users",
      "Key events",
      "Vs pre-launch average (%)",
    ],
    rows.map((row) => [
      row.start,
      row.end,
      row.sessions,
      row.users,
      row.keyEvents,
      row.vsBaseline === null ? "" : Math.round(row.vsBaseline * 10) / 10,
    ]),
  );
}
