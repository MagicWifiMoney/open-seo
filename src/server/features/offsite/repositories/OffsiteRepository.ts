import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { offsiteAuthoritySnapshots, offsiteOutreachLog } from "@/db/schema";
import type { OutreachChannel, OutreachStatus } from "@/types/schemas/offsite";

export type OffsiteSnapshot = typeof offsiteAuthoritySnapshots.$inferSelect;
export type OutreachEntry = typeof offsiteOutreachLog.$inferSelect;

const SNAPSHOT_LIMIT = 36;

async function saveSnapshot(input: {
  projectId: string;
  organizationId: string;
  domain: string;
  snapshotDate: string;
  referringDomains: number | null;
  backlinks: number | null;
  checkedAt: string;
}): Promise<OffsiteSnapshot> {
  const [row] = await db
    .insert(offsiteAuthoritySnapshots)
    .values({ id: crypto.randomUUID(), ...input })
    .onConflictDoUpdate({
      target: [
        offsiteAuthoritySnapshots.projectId,
        offsiteAuthoritySnapshots.snapshotDate,
      ],
      set: {
        domain: input.domain,
        referringDomains: input.referringDomains,
        backlinks: input.backlinks,
        checkedAt: input.checkedAt,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to save offsite snapshot");
  return row;
}

function listSnapshots(projectId: string): Promise<OffsiteSnapshot[]> {
  return db
    .select()
    .from(offsiteAuthoritySnapshots)
    .where(eq(offsiteAuthoritySnapshots.projectId, projectId))
    .orderBy(desc(offsiteAuthoritySnapshots.snapshotDate))
    .limit(SNAPSHOT_LIMIT);
}

function listOutreach(projectId: string): Promise<OutreachEntry[]> {
  return db
    .select()
    .from(offsiteOutreachLog)
    .where(eq(offsiteOutreachLog.projectId, projectId))
    .orderBy(desc(offsiteOutreachLog.createdAt));
}

async function addOutreach(input: {
  projectId: string;
  organizationId: string;
  targetName: string;
  targetUrl: string | null;
  channel: OutreachChannel;
  status: OutreachStatus;
  askedOn: string | null;
  linkedPageUrl: string | null;
  note: string | null;
}): Promise<OutreachEntry> {
  const [row] = await db
    .insert(offsiteOutreachLog)
    .values({ id: crypto.randomUUID(), ...input })
    .returning();
  if (!row) throw new Error("Failed to add outreach entry");
  return row;
}

async function updateOutreach(input: {
  projectId: string;
  id: string;
  status?: OutreachStatus;
  note?: string | null;
  askedOn?: string | null;
  linkedPageUrl?: string | null;
}): Promise<OutreachEntry | null> {
  const { projectId, id, ...changes } = input;
  const set = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  const [row] = await db
    .update(offsiteOutreachLog)
    .set({ ...set, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(offsiteOutreachLog.id, id),
        eq(offsiteOutreachLog.projectId, projectId),
      ),
    )
    .returning();
  return row ?? null;
}

async function deleteOutreach(projectId: string, id: string): Promise<void> {
  await db
    .delete(offsiteOutreachLog)
    .where(
      and(
        eq(offsiteOutreachLog.id, id),
        eq(offsiteOutreachLog.projectId, projectId),
      ),
    );
}

export const OffsiteRepository = {
  saveSnapshot,
  listSnapshots,
  listOutreach,
  addOutreach,
  updateOutreach,
  deleteOutreach,
};
