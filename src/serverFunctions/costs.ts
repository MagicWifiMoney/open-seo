import { createServerFn } from "@tanstack/react-start";
import { getProjectCosts } from "@/server/features/costs/ProjectCostsService";
import { fetchUserData } from "@/server/lib/dataforseo/appendix";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  listProjectCostsInputSchema,
  type ProjectCostsResponse,
} from "@/types/schemas/costs";

/** Free account balance (user_data appendix call); null when unavailable. */
async function readBalanceUsd(): Promise<number | null> {
  try {
    const balance = (await fetchUserData())?.money?.balance;
    return typeof balance === "number" && Number.isFinite(balance)
      ? balance
      : null;
  } catch {
    return null;
  }
}

/**
 * Read-only spend history for the Costs tab, open to every role including
 * `client`: it reports spend and triggers none, so it has no spend gate.
 */
export const listProjectCosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listProjectCostsInputSchema)
  .handler(async ({ data, context }): Promise<ProjectCostsResponse> => {
    const [costs, balanceUsd] = await Promise.all([
      getProjectCosts({ ...data, projectId: context.projectId }),
      readBalanceUsd(),
    ]);
    return { balanceUsd, ...costs };
  });
