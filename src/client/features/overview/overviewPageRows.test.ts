import { describe, expect, it } from "vitest";
import { buildPageTable, pagePath } from "./overviewPages";

const row = (key: string, clicks: number, impressions = 10, position = 5) => ({
  key,
  clicks,
  impressions,
  position,
});

describe("buildPageTable", () => {
  it("sorts by clicks, then impressions, and attaches the reference", () => {
    const table = buildPageTable({
      pages: [row("/b", 5, 50), row("/a", 5, 90), row("/c", 9)],
      comparePages: [row("/a", 2, 10, 8)],
      scale: 1,
    });
    expect(table.map((r) => r.key)).toEqual(["/c", "/a", "/b"]);
    expect(table[1]).toMatchObject({ clicksBefore: 2, positionBefore: 8 });
    expect(table[2]).toMatchObject({ clicksBefore: 0, positionBefore: null });
  });

  it("scales reference clicks and leaves them null when unreadable", () => {
    const scaled = buildPageTable({
      pages: [row("/a", 4)],
      comparePages: [row("/a", 12)],
      scale: 1 / 3,
    });
    expect(scaled[0].clicksBefore).toBeCloseTo(4);
    const unread = buildPageTable({
      pages: [row("/a", 4)],
      comparePages: null,
      scale: 1,
    });
    expect(unread[0].clicksBefore).toBeNull();
  });
});

describe("pagePath", () => {
  it("drops the origin and names the home page", () => {
    expect(pagePath("https://example.com/services/")).toBe("/services/");
    expect(pagePath("https://example.com/")).toBe("/ (home page)");
    expect(pagePath("not a url")).toBe("not a url");
  });
});
