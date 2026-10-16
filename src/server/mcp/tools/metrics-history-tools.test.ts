import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ga4DailyInputSchema,
  gscDailyInputSchema,
  getGa4DailyHistoryTool,
  getGscDailyHistoryTool,
  getMetricsHistoryStatusTool,
} from "./metrics-history-tools";

vi.mock("cloudflare:workers", () => ({ env: {} }));

const gsc = z.object(gscDailyInputSchema);
const ga4 = z.object(ga4DailyInputSchema);
const base = {
  projectId: "project_1",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
};

describe("metrics history MCP tools", () => {
  it("parses GSC input and rejects bad grain, date and limit", () => {
    expect(
      gsc.safeParse({
        ...base,
        grain: "query_page",
        limit: 10,
        orderBy: "impressions",
      }).success,
    ).toBe(true);
    expect(gsc.safeParse({ ...base, grain: "nope" }).success).toBe(false);
    expect(
      gsc.safeParse({ ...base, grain: "site", startDate: "01/01/2026" })
        .success,
    ).toBe(false);
    expect(gsc.safeParse({ ...base, grain: "page", limit: 1001 }).success).toBe(
      false,
    );
    expect(
      gsc.safeParse({ ...base, grain: "page", orderBy: "ctr" }).success,
    ).toBe(false);
  });

  it("parses GA4 input and rejects bad grain", () => {
    expect(ga4.safeParse({ ...base, grain: "key_event" }).success).toBe(true);
    expect(ga4.safeParse({ ...base, grain: "device" }).success).toBe(false);
  });

  it("names the tools and states they use no credits", () => {
    for (const tool of [
      getMetricsHistoryStatusTool,
      getGscDailyHistoryTool,
      getGa4DailyHistoryTool,
    ]) {
      expect(tool.config.description).toContain("uses no credits");
      expect(tool.config.description).toContain("scheduled ingest");
    }
    expect(getGscDailyHistoryTool.config.description).toContain("finalized");
    expect(getMetricsHistoryStatusTool.name).toBe("get_metrics_history_status");
    expect(getGscDailyHistoryTool.name).toBe("get_gsc_daily_history");
    expect(getGa4DailyHistoryTool.name).toBe("get_ga4_daily_history");
  });
});
