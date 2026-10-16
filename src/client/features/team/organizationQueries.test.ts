import { describe, expect, it, vi } from "vitest";

// The module imports server functions, whose graph reaches Workers-only
// bindings that don't resolve outside workerd.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import { canSpendForRole } from "./organizationQueries";

describe("canSpendForRole", () => {
  it("is false for the client role", () => {
    expect(canSpendForRole("client")).toBe(false);
  });

  it("is true for the owner role", () => {
    expect(canSpendForRole("owner")).toBe(true);
  });

  it("is true while the role is still loading", () => {
    expect(canSpendForRole(undefined)).toBe(true);
  });

  it("fails closed for an unknown role", () => {
    expect(canSpendForRole("nobody")).toBe(false);
  });
});
