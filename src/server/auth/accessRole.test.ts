import { describe, expect, it } from "vitest";
import { resolveAccessRole } from "./accessRole";

const env = {
  ACCESS_CLIENT_DOMAINS: "millerestatesolutions.com, Other.org",
  ACCESS_CLIENT_EMAILS: "Guest@Gmail.com",
};

describe("resolveAccessRole", () => {
  it("maps a listed domain to client", () => {
    expect(resolveAccessRole("a@millerestatesolutions.com", env)).toBe(
      "client",
    );
  });
  it("maps an exact email to client", () => {
    expect(resolveAccessRole("guest@gmail.com", env)).toBe("client");
  });
  it("is case-insensitive", () => {
    expect(resolveAccessRole("A@MillerEstateSolutions.COM", env)).toBe(
      "client",
    );
    expect(resolveAccessRole("GUEST@GMAIL.COM", env)).toBe("client");
  });
  it("does not match a lookalike domain or subdomain", () => {
    expect(resolveAccessRole("a@evil-millerestatesolutions.com", env)).toBe(
      "owner",
    );
    expect(resolveAccessRole("a@x.millerestatesolutions.com", env)).toBe(
      "owner",
    );
  });
  it("returns owner for unlisted users", () => {
    expect(resolveAccessRole("jake@example.com", env)).toBe("owner");
  });
  it("returns owner when env is unset", () => {
    expect(resolveAccessRole("a@millerestatesolutions.com", {})).toBe("owner");
  });
  it("returns owner for an empty email", () => {
    expect(resolveAccessRole("", env)).toBe("owner");
    expect(resolveAccessRole(undefined, env)).toBe("owner");
  });
});
