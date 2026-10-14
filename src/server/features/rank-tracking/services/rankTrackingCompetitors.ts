import { AiVisibilityRepository } from "@/server/features/ai-visibility/repositories/AiVisibilityRepository";
import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";

/** Completed runs scanned for the latest and previous position per keyword. */
const COMPETITOR_RUN_LIMIT = 8;

interface RankCompetitorCell {
  position: number | null;
  /** Position in the run before the latest one that covered this keyword. */
  previousPosition: number | null;
  url: string | null;
}

export interface RankCompetitorMatrix {
  device: "desktop" | "mobile";
  /** Saved project competitors, in the order the grid shows them. */
  competitors: string[];
  rows: Array<{
    trackingKeywordId: string;
    keyword: string;
    target: RankCompetitorCell;
    /** Keyed by competitor domain. */
    competitorCells: Record<string, RankCompetitorCell>;
  }>;
  /** Start time of the newest run with competitor data, or null. */
  latestCheckedAt: string | null;
}

interface RunPosition {
  runId: string;
  checkedAt: string;
  position: number | null;
  url: string | null;
}

/** Newest and second-newest entries by run time. */
function latestTwo(entries: RunPosition[] | undefined): RankCompetitorCell {
  if (!entries || entries.length === 0) {
    return { position: null, previousPosition: null, url: null };
  }
  const sorted = [...entries].sort((a, b) =>
    b.checkedAt.localeCompare(a.checkedAt),
  );
  return {
    position: sorted[0].position,
    previousPosition: sorted[1]?.position ?? null,
    url: sorted[0].url,
  };
}

function pushTo(
  map: Map<string, RunPosition[]>,
  key: string,
  value: RunPosition,
) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export async function getCompetitorMatrix(input: {
  configId: string;
  projectId: string;
  device: "desktop" | "mobile";
}): Promise<RankCompetitorMatrix> {
  const [raw, keywords, savedCompetitors] = await Promise.all([
    RankTrackingRepository.getCompetitorMatrixRows(
      input.configId,
      input.device,
      COMPETITOR_RUN_LIMIT,
    ),
    RankTrackingRepository.getKeywordsForConfig(input.configId),
    AiVisibilityRepository.listCompetitors(input.projectId),
  ]);

  const targetByKeyword = new Map<string, RunPosition[]>();
  for (const row of raw.target) {
    pushTo(targetByKeyword, row.trackingKeywordId, {
      runId: row.runId,
      checkedAt: row.checkedAt,
      position: row.position,
      url: row.url,
    });
  }
  const competitorByKey = new Map<string, RunPosition[]>();
  for (const row of raw.competitors) {
    pushTo(competitorByKey, `${row.trackingKeywordId}\u0000${row.domain}`, {
      runId: row.runId,
      checkedAt: row.checkedAt,
      position: row.position,
      url: row.url,
    });
  }

  // Only competitors still saved on the project and with data are shown;
  // removed competitors keep their history rows but leave the grid.
  const seenDomains = new Set(raw.competitors.map((r) => r.domain));
  const competitors = savedCompetitors
    .map((c) => c.domain)
    .filter((domain) => seenDomains.has(domain))
    .sort((a, b) => a.localeCompare(b));

  const rows = keywords.map((kw) => ({
    trackingKeywordId: kw.id,
    keyword: kw.keyword,
    target: latestTwo(targetByKeyword.get(kw.id)),
    competitorCells: Object.fromEntries(
      competitors.map((domain) => [
        domain,
        latestTwo(competitorByKey.get(`${kw.id}\u0000${domain}`)),
      ]),
    ),
  }));

  const latestCheckedAt =
    raw.competitors
      .map((r) => r.checkedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return { device: input.device, competitors, rows, latestCheckedAt };
}
