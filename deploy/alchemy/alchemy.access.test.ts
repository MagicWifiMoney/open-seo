import { describe, expect, it } from "vitest";
import { accessIncludeRule } from "./alchemy.access";

describe("accessIncludeRule", () => {
  it("turns @domain entries into emailDomain rules", () => {
    expect(accessIncludeRule("@millerestatesolutions.com")).toEqual({
      emailDomain: { domain: "millerestatesolutions.com" },
    });
  });
  it("keeps plain entries as exact email rules", () => {
    expect(accessIncludeRule("jake@example.com")).toEqual({
      email: { email: "jake@example.com" },
    });
  });
});
