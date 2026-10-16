import { useCanSpend } from "@/client/features/team/organizationQueries";
import { useQuery } from "@tanstack/react-query";
import { getDataforseoSpend } from "@/serverFunctions/dataforseo-spend";

export const dataforseoSpendKey = (projectId: string) =>
  ["dataforseoSpend", projectId] as const;

export function useDataforseoSpend(projectId: string) {
  // Balance and spend are billing detail; roles that cannot spend never see it.
  const canSpend = useCanSpend();
  return useQuery({
    enabled: canSpend,
    queryKey: dataforseoSpendKey(projectId),
    queryFn: () => getDataforseoSpend({ data: { projectId } }),
    staleTime: 60_000,
  });
}

const usd = (value: number) => `$${value.toFixed(2)}`;

/** Live DataForSEO balance and last-24h spend, so no screen spends blind. */
export function DataforseoSpendCard({ projectId }: { projectId: string }) {
  const canSpend = useCanSpend();
  const { data, isError } = useDataforseoSpend(projectId);
  if (!canSpend) return null;
  if (isError) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        DataForSEO balance unavailable right now.
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
      <div>
        DataForSEO balance{" "}
        <span className="font-mono font-semibold text-foreground">
          {data.balanceUsd === null ? "n/a" : usd(data.balanceUsd)}
        </span>
      </div>
      <div>
        Spent, last 24h{" "}
        <span className="font-mono font-semibold text-foreground">
          {usd(data.dayTotalUsd)}
        </span>
        {data.dayByFunction.length > 0 && (
          <>
            {" ("}
            {data.dayByFunction
              .slice(0, 3)
              .map((row) => `${row.name} ${usd(row.usd)}`)
              .join(", ")}
            {")"}
          </>
        )}
      </div>
    </div>
  );
}
