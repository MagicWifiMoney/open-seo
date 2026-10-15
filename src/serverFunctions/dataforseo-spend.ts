import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchUserData } from "@/server/lib/dataforseo/appendix";
import { requireProjectContext } from "@/serverFunctions/middleware";

export interface DataforseoSpendSnapshot {
  balanceUsd: number | null;
  lifetimeDepositedUsd: number | null;
  /** Rolling-day spend in USD by DataForSEO function (serp, keywords_data...). */
  dayByFunction: { name: string; usd: number }[];
  dayTotalUsd: number;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Free, non-billable account snapshot; the balance is account-wide. */
export const getDataforseoSpend = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async (): Promise<DataforseoSpendSnapshot> => {
    const data = await fetchUserData();
    const day = data?.money?.statistics?.day ?? {};
    const dayByFunction = Object.entries(day)
      .filter(([key]) => key.startsWith("total_"))
      .map(([key, value]) => ({
        name: key.replace(/^total_/, ""),
        usd: toNumber(value) ?? 0,
      }))
      .filter((row) => row.usd > 0)
      // oxlint-disable-next-line unicorn/no-array-sort -- fresh array; tsconfig lib lacks toSorted
      .sort((a, b) => b.usd - a.usd);
    return {
      balanceUsd: toNumber(data?.money?.balance),
      lifetimeDepositedUsd: toNumber(data?.money?.total),
      dayByFunction,
      // `day.total` is the account-wide figure; per-function keys can lag it.
      dayTotalUsd:
        toNumber(day.total) ??
        dayByFunction.reduce((sum, row) => sum + row.usd, 0),
    };
  });
