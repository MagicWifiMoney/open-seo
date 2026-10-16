import { describe, expect, it } from "vitest";
import { getProjectNavGroups } from "./items";

function labels(canSpend: boolean) {
  return getProjectNavGroups("p1", canSpend).flatMap((group) =>
    group.items.map((item) => item.label),
  );
}

describe("getProjectNavGroups", () => {
  it("shows everything to a role that can spend", () => {
    expect(labels(true)).toEqual(
      expect.arrayContaining([
        "Costs",
        "Domain Overview",
        "Backlinks",
        "Prompt Research",
        "Prompt Explorer",
        "Context",
        "Agent setup",
      ]),
    );
  });

  it("hides the paid and setup pages from a role that cannot spend", () => {
    const shown = labels(false);
    for (const hidden of [
      "Domain Overview",
      "Backlinks",
      "Prompt Research",
      "Prompt Explorer",
      "Context",
      "Agent setup",
    ]) {
      expect(shown).not.toContain(hidden);
    }
  });

  it("keeps the browse pages for a role that cannot spend", () => {
    expect(labels(false)).toEqual(
      expect.arrayContaining([
        "Overview",
        "Keyword Research",
        "Saved Keywords",
        "GSC Insights",
        "Traffic",
        "Rank Tracking",
        "Prompt Tracking",
        "Site Audit",
        "Costs",
        "Reports",
      ]),
    );
  });

  it("drops groups left empty", () => {
    expect(
      getProjectNavGroups("p1", false).every((g) => g.items.length > 0),
    ).toBe(true);
  });
});
