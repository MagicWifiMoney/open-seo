import { createServerFn } from "@tanstack/react-start";
import { chicagoDateOf } from "@/server/features/offsite/offsiteDates";
import { OffsiteRepository } from "@/server/features/offsite/repositories/OffsiteRepository";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addOutreachEntryInputSchema,
  deleteOutreachEntryInputSchema,
  listOffsiteSnapshotsInputSchema,
  listOutreachLogInputSchema,
  saveOffsiteSnapshotInputSchema,
  updateOutreachEntryInputSchema,
} from "@/types/schemas/offsite";

export const saveOffsiteSnapshot = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveOffsiteSnapshotInputSchema)
  .handler(({ data, context }) =>
    OffsiteRepository.saveSnapshot({
      projectId: context.projectId,
      organizationId: context.organizationId,
      domain: data.domain,
      snapshotDate: chicagoDateOf(data.fetchedAt),
      referringDomains: data.referringDomains,
      backlinks: data.backlinks,
      checkedAt: data.fetchedAt,
    }),
  );

export const listOffsiteSnapshots = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listOffsiteSnapshotsInputSchema)
  .handler(({ context }) => OffsiteRepository.listSnapshots(context.projectId));

export const listOutreachLog = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listOutreachLogInputSchema)
  .handler(({ context }) => OffsiteRepository.listOutreach(context.projectId));

export const addOutreachEntry = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addOutreachEntryInputSchema)
  .handler(({ data, context }) =>
    OffsiteRepository.addOutreach({
      ...data,
      projectId: context.projectId,
      organizationId: context.organizationId,
    }),
  );

export const updateOutreachEntry = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateOutreachEntryInputSchema)
  .handler(({ data, context }) =>
    OffsiteRepository.updateOutreach({ ...data, projectId: context.projectId }),
  );

export const deleteOutreachEntry = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(deleteOutreachEntryInputSchema)
  .handler(({ data, context }) =>
    OffsiteRepository.deleteOutreach(context.projectId, data.id),
  );
