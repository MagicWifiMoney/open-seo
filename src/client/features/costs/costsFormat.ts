import { sort } from "remeda";
import type { CostSource } from "@/types/schemas/costs";

/** `$0.0012` under one cent (up to 4 decimals, trailing zeros trimmed past 2),
 *  2 decimals otherwise. Exactly zero is `$0.00`. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0.00";
  const abs = Math.abs(value);
  if (abs >= 0.01) return `${value < 0 ? "-" : ""}$${abs.toFixed(2)}`;
  const text = abs.toFixed(4).replace(/0+$/, "");
  // Rounds to nothing at 4 decimals: show the floor rather than $0.00.
  if (Number(text) === 0) return `${value < 0 ? "-" : ""}<$0.0001`;
  return `${value < 0 ? "-" : ""}$${text}`;
}

export const SOURCE_LABELS: Record<CostSource, string> = {
  rank_check: "Rank checks",
  ai_visibility: "AI visibility",
  site_audit: "Audits",
  keyword_research: "Keyword research",
  serp: "SERP",
  domain: "Domain",
  backlinks: "Backlinks",
  local_seo: "Local SEO",
  ai_lookup: "AI lookups",
  llm: "LLM",
  rendering: "Rendering",
  other: "Other",
};

export function sourceLabel(source: string): string {
  const labels: Record<string, string> = SOURCE_LABELS;
  return labels[source] ?? source;
}

export const COST_RANGES = ["7d", "30d", "90d", "all"] as const;
export type CostRange = (typeof COST_RANGES)[number];
export const COST_RANGE_LABELS: Record<CostRange, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "All",
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** from/to for the server call; "all" sends no bounds. */
export function rangeWindow(
  range: CostRange,
  now: Date = new Date(),
): { from?: string; to?: string } {
  if (range === "all") return {};
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(now) };
}

export function topSources(
  bySource: Record<string, number>,
  count = 3,
): Array<{ source: string; usd: number }> {
  const items = Object.entries(bySource).map(([source, usd]) => ({
    source,
    usd,
  }));
  return sort(items, (a, b) => b.usd - a.usd).slice(0, count);
}

export function formatDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function csvText(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Numbers and dates stay bare; every string is quoted. */
export function toCsv(header: string[], rows: (string | number | null)[][]) {
  const lines = [header.map(csvText).join(",")];
  for (const row of rows) {
    lines.push(
      row
        .map((cell) =>
          cell === null
            ? ""
            : typeof cell === "number"
              ? String(cell)
              : csvText(cell),
        )
        .join(","),
    );
  }
  return lines.join("\n");
}
