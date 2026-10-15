import { sort } from "remeda";

export type PageRow = {
  key: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type PageTableRow = PageRow & {
  /** Clicks in the reference window, scaled to the current window length.
   *  Null when the reference window could not be read. */
  clicksBefore: number | null;
  /** Average position in the reference window; null when the page had no
   *  impressions there or the window could not be read. */
  positionBefore: number | null;
};

const TABLE_LIMIT = 25;

/** Rank by clicks, then impressions, then address so ties are stable. */
function byClicks(a: PageRow, b: PageRow): number {
  return (
    b.clicks - a.clicks ||
    b.impressions - a.impressions ||
    a.key.localeCompare(b.key)
  );
}

/** Top pages with their reference-window numbers attached. `scale` is the
 *  multiplier from the compare window (1 unless it is a weekly average). */
export function buildPageTable(input: {
  pages: PageRow[];
  comparePages: PageRow[] | null;
  scale: number;
  limit?: number;
}): PageTableRow[] {
  const before = input.comparePages
    ? new Map(input.comparePages.map((row) => [row.key, row]))
    : null;
  return sort(input.pages, byClicks)
    .slice(0, input.limit ?? TABLE_LIMIT)
    .map((row) => {
      if (!before) return { ...row, clicksBefore: null, positionBefore: null };
      const match = before.get(row.key);
      return {
        ...row,
        clicksBefore: (match?.clicks ?? 0) * input.scale,
        positionBefore: match && match.impressions > 0 ? match.position : null,
      };
    });
}

/** Address without the origin, so a table row is readable on a phone. */
export function pagePath(url: string): string {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return path === "/" ? "/ (home page)" : path;
  } catch {
    return url;
  }
}
