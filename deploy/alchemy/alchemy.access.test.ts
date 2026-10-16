import { describe, expect, it } from "vitest";
import { accessIncludeRule, ownerListProblem } from "./alchemy.access";

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

describe("ownerListProblem", () => {
  it("rejects a domain entry without an owner list", () => {
    expect(ownerListProblem(["@miller.com"], "")).toContain(
      "ACCESS_OWNER_EMAILS",
    );
    expect(ownerListProblem(["a@b.com", "@miller.com"], " , ")).not.toBeNull();
  });
  it("accepts a domain entry with an owner list", () => {
    expect(ownerListProblem(["@miller.com"], "jake@x.com")).toBeNull();
  });
  it("does not require owners for plain email lists", () => {
    expect(ownerListProblem(["a@b.com"], "")).toBeNull();
  });
});
