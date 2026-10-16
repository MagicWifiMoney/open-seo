import type { InsightsRow } from "@/types/schemas/gsc-insights";
import {
  formatInt,
  formatPosition,
  toneClass,
  type DeltaTone,
} from "./insightsFormat";

function MoversList({
  title,
  rows,
  tone,
  empty,
}: {
  title: string;
  rows: InsightsRow[];
  tone: DeltaTone;
  empty: string;
}) {
  return (
    <section className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium" title={row.key}>
                  {row.key}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatInt(row.clicks)} clicks now,{" "}
                  {formatInt(row.prevClicks)} before. Position{" "}
                  {formatPosition(row.position)}
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${toneClass[tone]}`}
              >
                {row.clicksDelta > 0 ? "+" : ""}
                {formatInt(row.clicksDelta)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InsightsMovers({
  gainers,
  losers,
}: {
  gainers: InsightsRow[];
  losers: InsightsRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MoversList
        title="Top gainers"
        rows={gainers}
        tone="good"
        empty="No queries gained clicks against the comparison period."
      />
      <MoversList
        title="Top losers"
        rows={losers}
        tone="bad"
        empty="No queries lost clicks against the comparison period."
      />
    </div>
  );
}
