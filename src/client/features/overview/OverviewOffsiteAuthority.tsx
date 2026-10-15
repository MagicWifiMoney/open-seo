import { useMutation, useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { getBacklinksOverview } from "@/serverFunctions/backlinks";
import { getDashboardActivation } from "@/serverFunctions/dashboard";
import { formatCheckedAt, formatOffsiteCount } from "./overviewOffsite";

const SOURCE = "DataForSEO backlinks, live check";

export function OverviewOffsiteAuthority({ projectId }: { projectId: string }) {
  // Same query key the dashboard uses, so the project's domain is usually cached.
  const activation = useQuery({
    queryKey: ["dashboardActivation", projectId],
    queryFn: () => getDashboardActivation({ data: { projectId } }),
  });
  const domain = activation.data?.domain ?? null;

  const check = useMutation({
    mutationFn: (target: string) =>
      getBacklinksOverview({ data: { projectId, target, scope: "domain" } }),
  });

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
          <p className="text-xs text-muted-foreground">
            We keep a month by month history once snapshots are saved. Until
            then this is today&apos;s number only, and the outreach log is kept
            separately.
          </p>
        </div>
      </CardShell>
    </section>
  );
}
