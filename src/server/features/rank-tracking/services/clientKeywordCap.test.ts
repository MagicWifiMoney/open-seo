import { describe, expect, it } from "vitest";
import {
  CLIENT_KEYWORD_CAP_MESSAGE,
  assertClientKeywordBudget,
} from "./clientKeywordCap";

const now = Date.parse("2026-10-16T12:00:00Z");
const rows = (n: number, createdAt: string) =>
  Array.from({ length: n }, (_, i) => ({ keyword: `k${i}`, createdAt }));
const words = (n: number, prefix = "new") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("assertClientKeywordBudget", () => {
  it("tags the refusal so the client shows the specific message", () => {
    expect(() =>
      assertClientKeywordBudget({ existing: [], incoming: words(21), now }),
    ).toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        details: { reason: "SPEND_NOT_ALLOWED" },
      }),
    );
  });
  it("allows up to 20 new keywords", () => {
    expect(() =>
      assertClientKeywordBudget({ existing: [], incoming: words(20), now }),
    ).not.toThrow();
  });
  it("rejects the 21st with the cap message", () => {
    expect(() =>
      assertClientKeywordBudget({ existing: [], incoming: words(21), now }),
    ).toThrow(CLIENT_KEYWORD_CAP_MESSAGE);
  });
  it("counts keywords created in the last 24h (D1 timestamp format)", () => {
    expect(() =>
      assertClientKeywordBudget({
        existing: rows(15, "2026-10-16 06:00:00"),
        incoming: words(6),
        now,
      }),
    ).toThrow(CLIENT_KEYWORD_CAP_MESSAGE);
  });
  it("ignores older keywords and handles ISO timestamps", () => {
    expect(() =>
      assertClientKeywordBudget({
        existing: rows(50, "2026-10-14T06:00:00.000Z"),
        incoming: words(20),
        now,
      }),
    ).not.toThrow();
  });
  it("does not count duplicates of existing keywords", () => {
    expect(() =>
      assertClientKeywordBudget({
        existing: rows(20, "2026-10-14 06:00:00"),
        incoming: ["K1", " k2 ", ...words(20)],
        now,
      }),
    ).not.toThrow();
  });
});
