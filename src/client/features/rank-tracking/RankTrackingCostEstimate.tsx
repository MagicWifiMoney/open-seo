import { useQuery } from "@tanstack/react-query";
import { estimateRankCheckCredits } from "@/shared/rank-tracking";
import { estimateRankCheckCost } from "@/serverFunctions/rank-tracking";
import { useDataforseoSpend } from "./DataforseoSpendCard";
import type { SaveConfigInput } from "./useSaveConfigMutations";

type ConfigFormValues = Pick<
  SaveConfigInput,
  "devices" | "serpDepth" | "schedule" | "trackCompetitors"
>;

export function CostEstimate({
  devices,
  serpDepth,
  schedule,
  trackCompetitors,
  projectId,
  configId,
}: Pick<
  ConfigFormValues,
  "devices" | "serpDepth" | "schedule" | "trackCompetitors"
> & { projectId: string; configId?: string }) {
  // Reuses the detail page's cache key, so an open tracker costs no extra call.
  const { data: tracked } = useQuery({
    queryKey: ["rankTrackingCostEstimate", projectId, configId],
    queryFn: () =>
      estimateRankCheckCost({ data: { projectId, configId: configId ?? "" } }),
    enabled: Boolean(configId),
  });
  const { data: spend } = useDataforseoSpend(projectId);
  const keywordCount = tracked?.keywordCount ?? 50;
  const isRealCount = tracked !== undefined;
  // Scheduled checks run through the cheaper task queue; manual configs only
  // ever pay the live price.
  const { costUsd: costPerKeyword } = estimateRankCheckCredits(
    ["plain keyword"],
    devices,
    serpDepth,
    schedule === "manual" ? "live" : "queued",
  );
  const checksPerMonth =
    schedule === "daily" ? 30 : schedule === "weekly" ? 4 : 1;
  return (
    <div className="space-y-0.5 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
      <div>
        <span className="font-mono font-semibold text-foreground">
          ~${costPerKeyword.toFixed(4)}
        </span>{" "}
        per keyword per check
      </div>
      {schedule !== "manual" && (
        <div>
          {isRealCount
            ? `${keywordCount} tracked keywords`
            : `${keywordCount} keywords would cost`}
          {" x "}
          {checksPerMonth} checks/month {isRealCount && "="}{" "}
          <span className="font-mono font-semibold text-foreground">
            ~${(costPerKeyword * keywordCount * checksPerMonth).toFixed(2)}
          </span>
          /month
        </div>
      )}
      {spend?.balanceUsd != null && (
        <div>
          Account balance{" "}
          <span className="font-mono font-semibold text-foreground">
            ${spend.balanceUsd.toFixed(2)}
          </span>
        </div>
      )}
      {trackCompetitors && (
        <div>
          Competitor tracking always crawls the full {serpDepth}-result depth,
          so this is the real price, not a ceiling.
        </div>
      )}
    </div>
  );
}
