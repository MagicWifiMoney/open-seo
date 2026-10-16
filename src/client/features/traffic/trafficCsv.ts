import { buildCsv } from "@/client/lib/csv";
import { percentChange, straddlesLaunch, type Bucket } from "./trafficMath";
import type { TrafficGranularity } from "@/types/schemas/traffic";

export type TrafficTableRow = Bucket & {
  /** Percent change of the selected metric vs the pre-launch average. */
  vsBaseline: number | null;
  /** The week or month holding the launch date: partly old site, so its change
   *  is withheld rather than presented as a gain. */
  partialOldSite: boolean;
};

export function buildTableRows(
  buckets: Bucket[],
  baseline: number | null,
  field: "sessions" | "users" | "keyEvents",
  launch: string,
  granularity: TrafficGranularity,
): TrafficTableRow[] {
  return buckets.map((bucket) => {
    const partialOldSite = straddlesLaunch(bucket, launch, granularity);
    return {
      ...bucket,
      partialOldSite,
      vsBaseline:
        baseline === null || partialOldSite
          ? null
          : percentChange(bucket[field], baseline),
    };
  });
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
      "Note",
    ],
    rows.map((row) => [
      row.start,
      row.end,
      row.sessions,
      row.users,
      row.keyEvents,
      row.vsBaseline === null ? "" : Math.round(row.vsBaseline * 10) / 10,
      row.partialOldSite
        ? "Partly old site, not a before or after reading"
        : "",
    ]),
  );
}
