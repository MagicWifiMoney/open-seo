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
