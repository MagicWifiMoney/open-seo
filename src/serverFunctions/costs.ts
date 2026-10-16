// STUB: the server worker's real file replaces this on merge. Keep names identical.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import type { ProjectCostsResponse } from "@/types/schemas/costs";

const inputSchema = z.object({
  projectId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const listProjectCosts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(inputSchema)
  .handler((): ProjectCostsResponse => {
    return {
      balanceUsd: 6.76,
      window: { from: "2026-09-16", to: "2026-10-16" },
      totals: { usd: 0.0123, byProvider: {}, bySource: { rank_check: 0.0123 } },
      days: [
        { date: "2026-10-15", usd: 0.0123, bySource: { rank_check: 0.0123 } },
      ],
      runs: [],
      lookups: [],
      ledgerSince: "2026-10-01",
    };
  });
