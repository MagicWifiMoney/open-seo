import { describe, expect, it } from "vitest";
import {
  countCompetitorsAhead,
  sortCompetitorRows,
} from "./RankTrackingCompetitorGrid.logic";

const cell = (position: number | null) => ({
  position,
  previousPosition: null,
  url: null,
});

function row(keyword: string, mine: number | null, rival: number | null) {
  return {
    trackingKeywordId: keyword,
    keyword,
    target: cell(mine),
    competitorCells: { "rival.com": cell(rival) },
  };
}

describe("competitor grid logic", () => {
  it("counts a seen competitor as ahead of an unranked target, not an unseen one", () => {
    expect(countCompetitorsAhead(row("a", null, 8))).toBe(1);
    expect(countCompetitorsAhead(row("a", null, null))).toBe(0);
    expect(countCompetitorsAhead(row("a", 3, 5))).toBe(0);
  });

  it("sorts keywords where competitors beat the target first", () => {
    const rows = [row("b", 2, 9), row("a", 5, 1), row("c", null, 4)];
    expect(
      sortCompetitorRows(rows, "competitorsAhead").map((r) => r.keyword),
    ).toEqual(["a", "c", "b"]);
  });
});
