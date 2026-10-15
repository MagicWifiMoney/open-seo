/** YYYY-MM-DD for an ISO instant, as the calendar date in Central Time. */
export function chicagoDateOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  // en-CA formats as YYYY-MM-DD.
  return date.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
