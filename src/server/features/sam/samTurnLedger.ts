import { CostLedgerRepository } from "@/server/features/costs/CostLedgerRepository";
import { withPgClient } from "@/db";

/** Writes one cost ledger row for a SAM chat turn. Never throws on a write. */
export async function ledgerSamTurn(
  loadContext: () => Promise<{
    project: { id: string; organizationId: string };
    row: { userId: string };
  } | null>,
  costUsd: number,
): Promise<void> {
  await withPgClient(async () => {
    const ctx = await loadContext();
    if (!ctx) return;
    await CostLedgerRepository.record({
      projectId: ctx.project.id,
      organizationId: ctx.project.organizationId,
      userId: ctx.row.userId,
      source: "llm",
      provider: "openrouter",
      creditFeature: "agent",
      operation: "SAM chat turn",
      costUsd,
      status: "ok",
    });
  });
}
