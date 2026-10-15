import { sort } from "remeda";

/** Plain formatting for the Off-site authority card. */

export function formatOffsiteCount(value: number | null): string {
  return value === null ? "Not reported" : value.toLocaleString("en-US");
}

/** "Oct 15, 2026, 3:04 PM CDT" in Central Time, or null if unparseable. */
export function formatCheckedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export type SnapshotLike = {
  snapshotDate: string;
  referringDomains: number | null;
  backlinks: number | null;
  checkedAt: string;
};

export type MonthRow = {
  /** YYYY-MM */
  month: string;
  label: string;
  referringDomains: number | null;
  /** "+N", "-N", "No change" or "first snapshot" */
  change: string;
  checkedDate: string;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-10" becomes "Oct 2026". */
export function monthLabel(month: string): string {
  const [year, mm] = month.split("-");
  const name = MONTH_NAMES[Number(mm) - 1];
  return name && year ? `${name} ${year}` : month;
}

/** "2026-10-15" becomes "Oct 15, 2026". */
export function formatSnapshotDate(date: string): string {
  const [year, mm, dd] = date.split("-");
  const name = MONTH_NAMES[Number(mm) - 1];
  return name && year && dd ? `${name} ${Number(dd)}, ${year}` : date;
}

export function formatChange(
  current: number | null,
  previous: number | null | undefined,
): string {
  if (previous === undefined) return "first snapshot";
  if (current === null || previous === null) return "Not comparable";
  const diff = current - previous;
  if (diff === 0) return "No change";
  return diff > 0 ? `+${diff}` : `-${Math.abs(diff)}`;
}

/**
 * Keeps the last snapshot of each calendar month and compares it with the
 * month before it. Returns newest month first. Input order does not matter.
 */
export function groupSnapshotsByMonth(snapshots: SnapshotLike[]): MonthRow[] {
  const lastOfMonth = new Map<string, SnapshotLike>();
  for (const snap of snapshots) {
    const month = snap.snapshotDate.slice(0, 7);
    const existing = lastOfMonth.get(month);
    if (!existing || snap.snapshotDate > existing.snapshotDate) {
      lastOfMonth.set(month, snap);
    }
  }
  const oldestFirst = sort([...lastOfMonth.entries()], ([a], [b]) =>
    a.localeCompare(b),
  );
  const rows = oldestFirst.map(([month, snap], index) => ({
    month,
    label: monthLabel(month),
    referringDomains: snap.referringDomains,
    change: formatChange(
      snap.referringDomains,
      index === 0 ? undefined : oldestFirst[index - 1]?.[1].referringDomains,
    ),
    checkedDate: formatSnapshotDate(snap.snapshotDate),
  }));
  return sort(rows, (a, b) => b.month.localeCompare(a.month));
}

export const CHANNEL_LABELS: Record<string, string> = {
  attorney: "Attorney",
  realtor: "Realtor",
  directory: "Directory",
  senior_living: "Senior living",
  press: "Press",
  paid_placement: "Paid placement",
  other: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  asked: "Asked",
  replied: "Replied",
  link_live: "Link is live",
  declined: "Declined",
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
