import { describe, expect, it } from "vitest";
import { BRAND_TERMS, brandFilterSets, isBrandQuery } from "./brandQueries";

describe("isBrandQuery", () => {
  it("defaults to the miller brand term", () => {
    expect(BRAND_TERMS).toEqual(["miller"]);
    expect(isBrandQuery("Miller Estate Solutions")).toBe(true);
    expect(isBrandQuery("millers estate sale")).toBe(true);
    expect(isBrandQuery("estate sale company near me")).toBe(false);
  });

  it("ignores blank terms and matches any listed term", () => {
    expect(isBrandQuery("anything", ["", "  "])).toBe(false);
    expect(isBrandQuery("acme rugs", ["Acme", "other"])).toBe(true);
  });
});

describe("brandFilterSets", () => {
  it("builds mutually exclusive sets so a query is never counted twice", () => {
    expect(brandFilterSets(["miller", "mes"])).toEqual([
      [{ operator: "contains", expression: "miller" }],
      [
        { operator: "notContains", expression: "miller" },
        { operator: "contains", expression: "mes" },
      ],
    ]);
  });
});
