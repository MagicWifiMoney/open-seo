import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectCostsResponse } from "@/types/schemas/costs";
import { CostsKpiRow } from "./CostsKpiRow";
import { RunCost } from "./CostsRunsTable";

const base: ProjectCostsResponse = {
  balanceUsd: null,
  window: { from: "2026-09-16", to: "2026-10-16" },
  totals: {
    usd: 1.5,
    byProvider: {},
    bySource: { rank_check: 1, ai_visibility: 0.4, site_audit: 0.1 },
  },
  days: [],
  runs: [],
  lookups: [],
  ledgerSince: null,
};

describe("CostsKpiRow", () => {
  it("renders totals and top sources", () => {
    const html = renderToStaticMarkup(
      createElement(CostsKpiRow, { data: base }),
    );
    expect(html).toContain("$1.50");
    expect(html).toContain("Rank checks");
    expect(html).toContain("$0.40");
    expect(html).not.toContain("est.");
  });
  it("marks estimated totals", () => {
    const html = renderToStaticMarkup(
      createElement(CostsKpiRow, {
        data: {
          ...base,
          runs: [
            {
              runId: "r1",
              runKind: "audit",
              source: "site_audit",
              label: "Audit",
              startedAt: "2026-10-01T00:00:00Z",
              completedAt: null,
              status: "completed",
              requested: "10 pages",
              got: "10 pages",
              costUsd: 0.1,
              costStatus: "estimated",
            },
          ],
        },
      }),
    );
    expect(html).toContain("est.");
  });
});

describe("RunCost", () => {
  it("suffixes estimated and partial", () => {
    expect(
      renderToStaticMarkup(
        createElement(RunCost, {
          run: { costUsd: 0.0012, costStatus: "estimated" },
        }),
      ),
    ).toContain("$0.0012 est.");
    expect(
      renderToStaticMarkup(
        createElement(RunCost, { run: { costUsd: 2, costStatus: "partial" } }),
      ),
    ).toContain("so far");
  });
});
