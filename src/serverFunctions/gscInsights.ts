import { createServerFn } from "@tanstack/react-start";
import { GscInsightsService } from "@/server/features/metrics-history/GscInsightsService";
import { gscInsightsInputSchema } from "@/types/schemas/gsc-insights";
import { requireProjectContext } from "@/serverFunctions/middleware";

/** Stored Search Console history for the GSC Insights page. Returns
 *  `{ coverage: null }` while no daily rows exist yet. */
export const getGscInsights = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(gscInsightsInputSchema)
  .handler(({ data, context }) =>
    GscInsightsService.getInsights({ ...data, projectId: context.projectId }),
  );
