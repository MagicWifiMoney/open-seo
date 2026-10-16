import { describe, expect, it } from "vitest";
import { canSpend, hasOrgPermission } from "./org-permissions";

describe("research:spend", () => {
  it("is granted to owner, admin and member", () => {
    for (const role of ["owner", "admin", "member"]) {
      expect(hasOrgPermission(role, { research: ["spend"] })).toBe(true);
      expect(canSpend(role)).toBe(true);
    }
  });
  it("is denied to client and unknown roles", () => {
    expect(hasOrgPermission("client", { research: ["spend"] })).toBe(false);
    expect(canSpend("client")).toBe(false);
    expect(canSpend("nobody")).toBe(false);
  });
  it("client has no billing, project or integration rights", () => {
    expect(hasOrgPermission("client", { billing: ["manage"] })).toBe(false);
    expect(hasOrgPermission("client", { project: ["create"] })).toBe(false);
    expect(hasOrgPermission("client", { project: ["delete"] })).toBe(false);
    expect(hasOrgPermission("client", { integration: ["manage"] })).toBe(false);
  });
});
