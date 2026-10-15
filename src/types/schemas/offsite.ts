import { z } from "zod";

export const OUTREACH_CHANNELS = [
  "attorney",
  "realtor",
  "directory",
  "senior_living",
  "press",
  "paid_placement",
  "other",
] as const;
export const OUTREACH_STATUSES = [
  "planned",
  "asked",
  "replied",
  "link_live",
  "declined",
] as const;

export const outreachChannelSchema = z.enum(OUTREACH_CHANNELS);
export const outreachStatusSchema = z.enum(OUTREACH_STATUSES);
export type OutreachChannel = z.infer<typeof outreachChannelSchema>;
export type OutreachStatus = z.infer<typeof outreachStatusSchema>;

const projectScoped = z.object({ projectId: z.string().min(1) });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const saveOffsiteSnapshotInputSchema = projectScoped.extend({
  domain: z.string().trim().min(1).max(253),
  referringDomains: z.number().int().min(0).nullable(),
  backlinks: z.number().int().min(0).nullable(),
  fetchedAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "fetchedAt must be an ISO date",
  }),
});

export const listOffsiteSnapshotsInputSchema = projectScoped;
export const listOutreachLogInputSchema = projectScoped;

export const addOutreachEntryInputSchema = projectScoped.extend({
  targetName: z.string().trim().min(1).max(200),
  targetUrl: optionalText(500).default(null),
  channel: outreachChannelSchema,
  status: outreachStatusSchema,
  askedOn: dateOnly.nullable().default(null),
  linkedPageUrl: optionalText(500).default(null),
  note: optionalText(1000).default(null),
});

export const updateOutreachEntryInputSchema = projectScoped.extend({
  id: z.string().min(1),
  status: outreachStatusSchema.optional(),
  note: optionalText(1000).optional(),
  askedOn: dateOnly.nullable().optional(),
  linkedPageUrl: optionalText(500).optional(),
});

export const deleteOutreachEntryInputSchema = projectScoped.extend({
  id: z.string().min(1),
});
