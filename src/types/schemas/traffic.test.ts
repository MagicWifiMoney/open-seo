import { describe, expect, it } from "vitest";
import {
  SITE_LAUNCH_DATE,
  TRAFFIC_SEARCH_DEFAULTS,
  trafficSearchSchema,
} from "./traffic";

describe("trafficSearchSchema", () => {
  it("fills the documented defaults from an empty query", () => {
    const parsed = trafficSearchSchema.parse({});
    expect(parsed).toMatchObject(TRAFFIC_SEARCH_DEFAULTS);
    expect(parsed.launch).toBe("2026-08-15");
    expect(parsed.launch).toBe(SITE_LAUNCH_DATE);
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });

  it("keeps valid values", () => {
    const parsed = trafficSearchSchema.parse({
      range: "custom",
      metric: "key_events",
      channel: "organic_search",
      granularity: "month",
      compare: "yoy",
      launch: "2026-01-02",
      from: "2025-06-01",
      to: "2025-07-01",
    });
    expect(parsed.range).toBe("custom");
    expect(parsed.metric).toBe("key_events");
    expect(parsed.launch).toBe("2026-01-02");
    expect(parsed.from).toBe("2025-06-01");
  });

  it("falls back to defaults on invalid values", () => {
    const parsed = trafficSearchSchema.parse({
      range: "forever",
      metric: "revenue",
      launch: "2026-02-31",
      from: "not-a-date",
    });
    expect(parsed).toMatchObject(TRAFFIC_SEARCH_DEFAULTS);
    expect(parsed.from).toBeUndefined();
  });
});
