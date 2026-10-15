import { reverse, sort } from "remeda";

export type RunCoverage = {
  runId: string;
  checkedAt: string;
  top3: number;
  top4to10: number;
  top11to20: number;
  notRanking: number;
  notChecked: number;
};

export type PositionCell = {
  runId: string;
  trackingKeywordId: string;
  position: number | null;
};

type BandKey = "top3" | "top10" | "top20" | "top40" | "none";

const BANDS: Array<{
  key: BandKey;
  label: string;
  meaning: string;
}> = [
  {
    key: "top3",
    label: "Positions 1 to 3",
    meaning: "Top of the first page, where most clicks happen.",
  },
  {
    key: "top10",
    label: "Positions 4 to 10",
    meaning: "Rest of the first page. Seen often, clicked less.",
  },
  {
    key: "top20",
    label: "Positions 11 to 20",
    meaning: "Second page. Few people look here.",
  },
  {
    key: "top40",
    label: "Positions 21 to 40",
    meaning: "Pages three and four. Almost never seen.",
  },
  {
    key: "none",
    label: "Not ranking",
    meaning:
      "Not found in the part of Google results the tracker checks, so no position is recorded.",
  },
];

export function bandOf(position: number | null): BandKey {
  if (position === null || position < 1 || position > 40) return "none";
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  if (position <= 20) return "top20";
  return "top40";
}

export type BandRow = {
  key: BandKey;
  label: string;
  meaning: string;
  count: number;
  /** Count in the previous complete run; null when there is none. */
  before: number | null;
};

export type Mover = {
  keyword: string;
  before: number;
  now: number;
  /** Places gained (positive) or lost (negative). */
  change: number;
};

export type RankingsView = {
  latest: { runId: string; checkedAt: string };
  previous: { runId: string; checkedAt: string } | null;
  checked: number;
  total: number;
  partial: boolean;
  bands: BandRow[];
  topTenNow: number;
  topTenBefore: number | null;
  gains: Mover[];
  losses: Mover[];
  /** Keywords that were not ranking in the previous run and rank now. */
  entered: string[];
  /** Keywords that ranked in the previous run and no longer do. */
  dropped: string[];
};

const MOVER_LIMIT = 5;
const LIST_LIMIT = 5;

function byKeyword(a: Mover, b: Mover): number {
  return a.keyword.localeCompare(b.keyword);
}

function checked(run: RunCoverage): number {
  return run.top3 + run.top4to10 + run.top11to20 + run.notRanking;
}

function positionsFor(cells: PositionCell[], runId: string) {
  const positions = new Map<string, number | null>();
  for (const cell of cells) {
    if (cell.runId === runId) {
      positions.set(cell.trackingKeywordId, cell.position);
    }
  }
  return positions;
}

function countBands(positions: Map<string, number | null>) {
  const counts: Record<BandKey, number> = {
    top3: 0,
    top10: 0,
    top20: 0,
    top40: 0,
    none: 0,
  };
  for (const position of positions.values()) counts[bandOf(position)] += 1;
  return counts;
}

/** Bands, coverage and movers for one tracker and device.
 *
 *  `runs` are the completed full runs, oldest first. Coverage comes from the
 *  run's own counts: `notChecked` is keywords whose check failed and left no
 *  row, so it is never counted as "not ranking". The comparison run is the
 *  most recent earlier run that checked every keyword. Keywords no longer
 *  tracked (not in `names`) are left out. */
export function buildRankingsView(input: {
  runs: RunCoverage[];
  cells: PositionCell[];
  names: Map<string, string>;
}): RankingsView | null {
  const { runs, cells, names } = input;
  const latest = runs.at(-1);
  if (!latest) return null;

  const withCells = new Set(cells.map((cell) => cell.runId));
  const previous = reverse(runs.slice(0, -1)).find(
    (run) => run.notChecked === 0 && withCells.has(run.runId),
  );

  const live = (positions: Map<string, number | null>) =>
    new Map([...positions].filter(([id]) => names.has(id)));
  const nowPositions = live(positionsFor(cells, latest.runId));
  const beforePositions = previous
    ? live(positionsFor(cells, previous.runId))
    : null;
  const nowCounts = countBands(nowPositions);
  const beforeCounts = beforePositions ? countBands(beforePositions) : null;

  const gains: Mover[] = [];
  const losses: Mover[] = [];
  const entered: string[] = [];
  const dropped: string[] = [];
  if (beforePositions) {
    for (const [id, now] of nowPositions) {
      if (!beforePositions.has(id)) continue;
      const before = beforePositions.get(id) ?? null;
      const keyword = names.get(id) ?? id;
      const nowRanked = bandOf(now) !== "none";
      const beforeRanked = bandOf(before) !== "none";
      if (nowRanked && !beforeRanked) entered.push(keyword);
      else if (!nowRanked && beforeRanked) dropped.push(keyword);
      else if (nowRanked && beforeRanked && now !== null && before !== null) {
        const change = before - now;
        if (change > 0) gains.push({ keyword, before, now, change });
        if (change < 0) losses.push({ keyword, before, now, change });
      }
    }
  }
  gains.sort((a, b) => b.change - a.change || byKeyword(a, b));
  losses.sort((a, b) => a.change - b.change || byKeyword(a, b));

  const checkedCount = checked(latest);
  return {
    latest: { runId: latest.runId, checkedAt: latest.checkedAt },
    previous: previous
      ? { runId: previous.runId, checkedAt: previous.checkedAt }
      : null,
    checked: checkedCount,
    total: checkedCount + latest.notChecked,
    partial: latest.notChecked > 0,
    bands: BANDS.map((band) => ({
      ...band,
      count: nowCounts[band.key],
      before: beforeCounts ? beforeCounts[band.key] : null,
    })),
    topTenNow: nowCounts.top3 + nowCounts.top10,
    topTenBefore: beforeCounts ? beforeCounts.top3 + beforeCounts.top10 : null,
    gains: gains.slice(0, MOVER_LIMIT),
    losses: losses.slice(0, MOVER_LIMIT),
    entered: sort(entered, (a, b) => a.localeCompare(b)).slice(0, LIST_LIMIT),
    dropped: sort(dropped, (a, b) => a.localeCompare(b)).slice(0, LIST_LIMIT),
  };
}

/** The tracker to show when none is chosen: the one with the most keywords,
 *  first created wins a tie (input order). */
export function defaultTracker<T extends { keywordCount: number }>(
  configs: T[],
): T | null {
  let best: T | null = null;
  for (const config of configs) {
    if (!best || config.keywordCount > best.keywordCount) best = config;
  }
  return best;
}
