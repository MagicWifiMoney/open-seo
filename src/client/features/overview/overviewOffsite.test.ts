import { describe, expect, it } from "vitest";
import { formatCheckedAt, formatOffsiteCount } from "./overviewOffsite";

describe("formatOffsiteCount", () => {
  it("groups thousands", () => {
    expect(formatOffsiteCount(12345)).toBe("12,345");
    expect(formatOffsiteCount(0)).toBe("0");
  });
  it("says so when the provider returned nothing", () => {
    expect(formatOffsiteCount(null)).toBe("Not reported");
  });
});

describe("formatCheckedAt", () => {
  it("prints Central Time", () => {
    expect(formatCheckedAt("2026-10-15T20:04:00Z")).toBe(
      "Oct 15, 2026, 3:04 PM CDT",
    );
  });
  it("returns null for junk", () => {
    expect(formatCheckedAt("nope")).toBeNull();
  });
});
