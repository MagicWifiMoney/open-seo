import { describe, expect, it } from "vitest";
import {
  csvText,
  formatUsd,
  rangeWindow,
  toCsv,
  topSources,
} from "./costsFormat";

describe("formatUsd", () => {
  it("uses 2 decimals from one cent up", () => {
    expect(formatUsd(0.01)).toBe("$0.01");
    expect(formatUsd(6.756)).toBe("$6.76");
    expect(formatUsd(1234.5)).toBe("$1234.50");
  });
  it("uses up to 4 decimals under one cent", () => {
    expect(formatUsd(0.0012)).toBe("$0.0012");
    expect(formatUsd(0.005)).toBe("$0.005");
    expect(formatUsd(0.00004)).toBe("<$0.0001");
  });
  it("handles zero and non-finite", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(Number.NaN)).toBe("$0.00");
  });
});

describe("helpers", () => {
  it("builds the window and sorts top sources", () => {
    expect(rangeWindow("all")).toEqual({});
    expect(rangeWindow("7d", new Date("2026-10-16T12:00:00Z"))).toEqual({
      from: "2026-10-10",
      to: "2026-10-16",
    });
    expect(
      topSources({ a: 1, b: 3, c: 2, d: 0.5 }).map((s) => s.source),
    ).toEqual(["b", "c", "a"]);
  });
  it("quotes strings and leaves numbers bare", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ['x "y"', 1.5],
          [null, 2],
        ],
      ),
    ).toBe('"a","b"\n"x ""y""",1.5\n,2');
  });
  it("neutralizes spreadsheet formulas", () => {
    for (const ch of ["=", "+", "-", "@", "\t", "\r"])
      expect(csvText(`${ch}SUM(A1)`)).toBe(`"'${ch}SUM(A1)"`);
    expect(csvText("  =1+1")).toBe(`"'  =1+1"`);
    expect(csvText("boat rental")).toBe('"boat rental"');
  });
});
