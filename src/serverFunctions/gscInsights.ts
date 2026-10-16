import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GscInsightsService } from "@/server/features/metrics-history/GscInsightsService";
import {
  GSC_INSIGHTS_COMPARES,
  GSC_INSIGHTS_DEVICES,
  GSC_INSIGHTS_RANGES,
} from "@/types/schemas/gsc-insights";
import { requireProjectContext } from "@/serverFunctions/middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const gscInsightsInputSchema = z.object({
  projectId: z.string().min(1),
  range: z.enum(GSC_INSIGHTS_RANGES).default("3m"),
  // Custom window: both dates together override the preset.
  from: isoDate.optional(),
  to: isoDate.optional(),
  compare: z.enum(GSC_INSIGHTS_COMPARES).default("previous_period"),
  device: z.enum(GSC_INSIGHTS_DEVICES).default("all"),
});

/** Stored Search Console history for the GSC Insights page. Returns
 *  `{ coverage: null }` while no daily rows exist yet. */
export const getGscInsights = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(gscInsightsInputSchema)
  .handler(({ data, context }) =>
    GscInsightsService.getInsights({ ...data, projectId: context.projectId }),
  );
