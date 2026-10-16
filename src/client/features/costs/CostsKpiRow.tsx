import { CardShell } from "@/client/components/CardShell";
import type { ProjectCostsResponse } from "@/types/schemas/costs";
import { formatUsd, sourceLabel, topSources } from "./costsFormat";

export function hasEstimates(runs: ProjectCostsResponse["runs"]): boolean {
  return runs.some((run) => run.costStatus !== "actual");
}

export function CostsKpiRow({ data }: { data: ProjectCostsResponse }) {
  const top = topSources(data.totals.bySource);
  const estimated = hasEstimates(data.runs);
  return (
    <section
      aria-label="Key metrics"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <CardShell title="Total spend">
        <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
          {formatUsd(data.totals.usd)}
        </p>
        {estimated ? (
          <p className="mt-1 text-sm text-muted-foreground">
            est. includes estimated runs
          </p>
        ) : null}
      </CardShell>
      <CardShell title="Top sources">
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spend yet</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {top.map((item) => (
              <li key={item.source} className="flex justify-between gap-2">
                <span className="truncate">{sourceLabel(item.source)}</span>
                <span className="tabular-nums">{formatUsd(item.usd)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardShell>
      <CardShell title="Runs">
        <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
          {data.runs.length.toLocaleString("en-US")}
        </p>
      </CardShell>
      <CardShell title="Lookups">
        <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
          {data.lookups.length.toLocaleString("en-US")}
        </p>
      </CardShell>
    </section>
  );
}
