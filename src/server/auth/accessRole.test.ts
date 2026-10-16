import { describe, expect, it } from "vitest";
import { resolveAccessRole } from "./accessRole";

const env = { ACCESS_OWNER_EMAILS: "Jake@Example.com, ops@example.com" };

describe("resolveAccessRole", () => {
  it("maps a listed email to owner, case-insensitively", () => {
    expect(resolveAccessRole("jake@example.com", env)).toBe("owner");
    expect(resolveAccessRole("OPS@EXAMPLE.COM", env)).toBe("owner");
  });
  it("maps everyone else to client", () => {
    expect(resolveAccessRole("a@millerestatesolutions.com", env)).toBe(
      "client",
    );
  });
  it("does not match lookalike emails", () => {
    expect(resolveAccessRole("xjake@example.com", env)).toBe("client");
    expect(resolveAccessRole("jake@example.com.evil.io", env)).toBe("client");
  });
  it("fails closed for an empty or missing email when owners are set", () => {
    expect(resolveAccessRole("", env)).toBe("client");
    expect(resolveAccessRole(undefined, env)).toBe("client");
    expect(resolveAccessRole(null, env)).toBe("client");
  });
  it("returns owner for everyone when the owner list is unset or blank", () => {
    expect(resolveAccessRole("a@x.com", {})).toBe("owner");
    expect(resolveAccessRole("a@x.com", { ACCESS_OWNER_EMAILS: " , " })).toBe(
      "owner",
    );
    expect(resolveAccessRole("", {})).toBe("owner");
  });
});
