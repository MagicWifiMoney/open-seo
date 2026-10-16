import { createServerFn } from "@tanstack/react-start";
import { ProjectWebsiteService } from "@/server/features/projects/services/ProjectWebsiteService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  researchProjectWebsiteSchema,
  saveProjectWebsiteSetupSchema,
} from "@/types/schemas/projectWebsite";
import { requireSpend } from "@/server/auth/org-gate";

export const researchProjectWebsite = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(researchProjectWebsiteSchema)
  .handler(({ data, context }) => {
    requireSpend(context);
    return ProjectWebsiteService.research(
      context.projectId,
      data.website,
      context,
    );
  });
// Gated: setup seeds a scheduled AI tracker and starts its first run.
export const saveProjectWebsiteSetup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveProjectWebsiteSetupSchema)
  .handler(({ data, context }) => {
    requireSpend(context);
    return ProjectWebsiteService.save(
      { ...data, projectId: context.projectId },
      context,
      "user",
      { runSeededTracking: true },
    );
  });
