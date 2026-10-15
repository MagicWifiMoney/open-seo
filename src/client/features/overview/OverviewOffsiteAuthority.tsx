import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { getBacklinksOverview } from "@/serverFunctions/backlinks";
import { getDashboardActivation } from "@/serverFunctions/dashboard";
import {
  listOffsiteSnapshots,
  saveOffsiteSnapshot,
} from "@/serverFunctions/offsite";
import { OverviewOutreachLog } from "./OverviewOutreachLog";
import {
  formatCheckedAt,
  formatOffsiteCount,
  groupSnapshotsByMonth,
} from "./overviewOffsite";

const SOURCE = "DataForSEO backlinks (results can be a few hours old)";

export function OverviewOffsiteAuthority({ projectId }: { projectId: string }) {
  // Same query key the dashboard uses, so the project's domain is usually cached.
  const activation = useQuery({
    queryKey: ["dashboardActivation", projectId],
    queryFn: () => getDashboardActivation({ data: { projectId } }),
  });
  const domain = activation.data?.domain ?? null;

  const queryClient = useQueryClient();
  const historyKey = ["offsiteSnapshots", projectId];
  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => listOffsiteSnapshots({ data: { projectId } }),
  });
  const saveSnapshot = useMutation({
    mutationFn: saveOffsiteSnapshot,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: historyKey }),
  });

  const check = useMutation({
    mutationFn: (target: string) =>
      getBacklinksOverview({ data: { projectId, target, scope: "domain" } }),
    onSuccess: (overview, target) =>
      saveSnapshot.mutate({
        data: {
          projectId,
          domain: target,
          referringDomains: overview.summary.referringDomains,
          backlinks: overview.summary.backlinks,
          fetchedAt: overview.fetchedAt,
        },
      }),
  });

  const months = groupSnapshotsByMonth(history.data ?? []);

  const result = check.data;
  const checkedAt = result ? formatCheckedAt(result.fetchedAt) : null;

  return (
    <section aria-label="Off-site authority">
      <CardShell title="Off-site authority">
        <div className="space-y-3">
          {activation.isError && !activation.data ? (
            <QueryError
              error={activation.error}
              fallback="Could not load the website for this project"
              onRetry={() => void activation.refetch()}
              isRetrying={activation.isFetching}
            />
          ) : activation.isPending ? (
            <p className="text-sm text-muted-foreground">
              Loading the project website...
            </p>
          ) : domain === null ? (
            <p className="text-sm text-muted-foreground">
              No website is set for this project, so there is nothing to check.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Checking {domain} uses DataForSEO credits (a small number of
                credits). Nothing is fetched until you click.
              </p>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="print:hidden"
                  disabled={check.isPending}
                  onClick={() => check.mutate(domain)}
                >
                  {check.isPending
                    ? "Checking..."
                    : result
                      ? "Check again"
                      : "Check referring domains now"}
                </Button>
              </div>
            </>
          )}

          {check.isError ? (
            <QueryError
              error={check.error}
              fallback="The referring domains check failed, so no numbers are shown"
              onRetry={() => (domain ? check.mutate(domain) : undefined)}
              isRetrying={check.isPending}
            />
          ) : null}

          {result ? (
            <div className="space-y-2">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Referring main domains
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {formatOffsiteCount(result.summary.referringDomains)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Total backlinks
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {formatOffsiteCount(result.summary.backlinks)}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                Source: {SOURCE}
                {checkedAt ? `, checked ${checkedAt}` : ""}.
              </p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              What this means:{" "}
            </span>
            Referring domains are other websites that link to the site. More
            good ones from relevant local sites helps, but it is not a ranking
            guarantee.
          </p>
          {saveSnapshot.isError ? (
            <p className="text-sm text-destructive">
              The numbers above were not saved to the history. Click Check again
              to retry.
            </p>
          ) : null}

          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Month by month</h3>
            {history.isError && !history.data ? (
              <QueryError
                error={history.error}
                fallback="Could not load the saved history"
                onRetry={() => void history.refetch()}
                isRetrying={history.isFetching}
              />
            ) : history.isPending ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : months.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No snapshots saved yet. Click Check referring domains now to
                save the first one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Month</th>
                      <th className="py-1 pr-3 font-medium">
                        Referring domains
                      </th>
                      <th className="py-1 pr-3 font-medium">
                        Change from last month
                      </th>
                      <th className="py-1 font-medium">Checked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((row) => (
                      <tr key={row.month} className="border-t">
                        <td className="py-1 pr-3">{row.label}</td>
                        <td className="py-1 pr-3 tabular-nums">
                          {formatOffsiteCount(row.referringDomains)}
                        </td>
                        <td className="py-1 pr-3">{row.change}</td>
                        <td className="py-1 whitespace-nowrap">
                          {row.checkedDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Source: {SOURCE}. Each check is saved automatically, and the last
              check of each month is shown.
            </p>
          </div>

          <OverviewOutreachLog projectId={projectId} />
        </div>
      </CardShell>
    </section>
  );
}
