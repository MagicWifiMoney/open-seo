import { z } from "zod";
import { sort } from "remeda";
import { RankTrackingRepository } from "../repositories/RankTrackingRepository";
import { getLatestResults } from "./rankTrackingResults";

export const MILLER_HUB_FEED_PATH = "/api/public/miller-scoreboard";
const PROJECT_ID = "a3a7dde6-d78e-4912-bb18-d681a725392f";
const DOMAIN = "millerestatesolutions.com";
const HOST = "open-seo-miller.magicwifimoney.workers.dev";
const uuid = z.string().uuid();
type FeedEnv = Pick<
  Cloudflare.Env,
  "AUTH_MODE" | "MILLER_HUB_FEED_ENABLED" | "MILLER_HUB_TRACKER_ID"
>;
type Device = "desktop" | "mobile";
class FeedDataError extends Error {
  get code(): string {
    return this.message;
  }
}

function json(body: unknown, status: number, success = false): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": success
        ? "public, max-age=60, s-maxage=300"
        : "no-store",
    },
  });
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime())
      ? timestamp(value.toISOString())
      : null;
  if (typeof value !== "string") return null;
  // SQLite CURRENT_TIMESTAMP is UTC but has no timezone suffix.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
    ? value.replace(" ", "T") + "Z"
    : value;
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(normalized))
    return null;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) &&
    date.getTime() <= Date.now() + 300_000
    ? date.toISOString()
    : null;
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      ![DOMAIN, `www.${DOMAIN}`].includes(url.hostname) ||
      url.port
    )
      return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function position(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0)
    throw new FeedDataError("invalid_saved_rank");
  return value;
}

function deviceStatus(value: { position: number | null } | undefined) {
  return !value ? "unchecked" : value.position === null ? "out" : "ranked";
}

async function loadSnapshot(configId: string) {
  // Gate config-ID-only repository reads behind the project-scoped lookup.
  const config = await RankTrackingRepository.getConfigById({
    configId,
    projectId: PROJECT_ID,
  });
  if (
    !config ||
    config.id !== configId ||
    config.projectId !== PROJECT_ID ||
    ![DOMAIN, `www.${DOMAIN}`].includes(config.domain)
  )
    throw new FeedDataError("invalid_tracker_scope");
  const devices: Device[] =
    config.devices === "both"
      ? ["desktop", "mobile"]
      : config.devices === "desktop" || config.devices === "mobile"
        ? [config.devices]
        : [];
  if (
    !devices.length ||
    !Number.isInteger(config.serpDepth) ||
    config.serpDepth <= 0
  )
    throw new FeedDataError("invalid_tracker_settings");
  const [results, snapshots, latestRun] = await Promise.all([
    getLatestResults(configId, PROJECT_ID, "7d"),
    RankTrackingRepository.getLatestSnapshotsForKeywords(configId),
    RankTrackingRepository.getLatestRunForConfig(configId),
  ]);
  if (
    !results.rows.length ||
    results.rows.length > 1000 ||
    snapshots.length > 2000
  )
    throw new FeedDataError("invalid_tracker_rows");
  const saved = new Map<
    string,
    { position: number | null; url: string | null; checkedAt: string }
  >();
  for (const snapshot of snapshots) {
    const key = `${snapshot.trackingKeywordId}:${snapshot.device}`;
    const checkedAt = timestamp(snapshot.checkedAt);
    if (saved.has(key) || !checkedAt)
      throw new FeedDataError("invalid_saved_snapshots");
    saved.set(key, {
      position: position(snapshot.position),
      url: safeUrl(snapshot.url),
      checkedAt,
    });
  }
  const seen = new Set<string>();
  const ranks = results.rows.map((row) => {
    const keyword = row.keyword.trim();
    if (!keyword || keyword.length > 500 || seen.has(keyword.toLowerCase()))
      throw new FeedDataError("invalid_saved_keywords");
    seen.add(keyword.toLowerCase());
    const deviceData = (device: Device) =>
      devices.includes(device)
        ? saved.get(`${row.trackingKeywordId}:${device}`)
        : undefined;
    const desktop = deviceData("desktop"),
      mobile = deviceData("mobile");
    const selected = devices.map(deviceData);
    const ranked = sort(
      selected.filter((value) => value?.position != null),
      (a, b) => a!.position! - b!.position!,
    );
    const best = ranked[0];
    const status = best
      ? "ranked"
      : selected.some((value) => !value)
        ? "unchecked"
        : "out";
    return {
      keyword,
      position: best?.position ?? null,
      previousPosition: null,
      desktopPosition: desktop?.position ?? null,
      mobilePosition: mobile?.position ?? null,
      desktopStatus: deviceStatus(desktop),
      mobileStatus: deviceStatus(mobile),
      desktopCheckedAt: desktop?.checkedAt ?? null,
      mobileCheckedAt: mobile?.checkedAt ?? null,
      rankingUrl: best?.url ?? null,
      status,
    };
  });
  const dates = sort(
    ranks
      .flatMap((row) => [row.desktopCheckedAt, row.mobileCheckedAt])
      .filter((date): date is string => date !== null),
    (a, b) => a.localeCompare(b),
  );
  const asOf = dates.at(-1);
  if (!asOf) throw new FeedDataError("no_saved_snapshot_date");
  const checked = results.rows.filter((row) =>
    devices.every((device) => saved.has(`${row.trackingKeywordId}:${device}`)),
  ).length;
  return {
    version: 1,
    brand: "Quiet Coyote MN",
    client: "Miller Estate Solutions",
    domain: DOMAIN,
    hubUrl: "https://millerestate.quietcoyotemn.com/visibility",
    asOf,
    stale:
      latestRun?.status !== "completed" ||
      dates.some((date) => Date.now() - Date.parse(date) > 8 * 86400000),
    empty: false,
    visibility: {
      score: null,
      estimatedClicks: null,
      tracked: ranks.length,
      ranked: ranks.filter((row) => row.position !== null).length,
      top10: ranks.filter((row) => row.position !== null && row.position <= 10)
        .length,
      top3: ranks.filter((row) => row.position !== null && row.position <= 3)
        .length,
      out: ranks.filter((row) => row.status === "out").length,
      error: 0,
    },
    moversUp: [],
    moversDown: [],
    ranks,
    ai: {
      estimated: true,
      mentions: null,
      citations: null,
      platforms: [],
      asOf: null,
      watch: "AI visibility is not included in this saved rank tracker feed.",
    },
    competitors: [],
    competitorNote: "Competitor measurements are not included in this feed.",
    wins: [],
    next: [
      "Saved results may span check dates. Device dates show when each result was checked. Rank comparisons are unavailable in this feed.",
    ],
    source: "OpenSEO dedicated Miller rank tracker",
    campaignId: configId,
    tracking: {
      location:
        config.locationName?.trim() || `Location code ${config.locationCode}`,
      devices,
      depth: config.serpDepth,
      schedule: config.scheduleInterval,
      checked,
      unchecked: ranks.length - checked,
    },
  };
}

export async function handleMillerHubFeed(
  request: Request,
  env: FeedEnv,
): Promise<Response> {
  const url = new URL(request.url);
  if (
    url.pathname !== MILLER_HUB_FEED_PATH ||
    url.hostname !== HOST ||
    url.protocol !== "https:" ||
    url.port ||
    env.AUTH_MODE !== "cloudflare_access" ||
    env.MILLER_HUB_FEED_ENABLED !== "true"
  )
    return json({ error: "Not found" }, 404);
  if (request.method !== "GET")
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" },
    });
  if (
    [...url.searchParams].some(
      ([key, value]) => key !== "history" || value !== "1",
    ) ||
    url.searchParams.getAll("history").length > 1
  )
    return json({ error: "Unsupported query" }, 400);
  const trackerId = uuid.safeParse(env.MILLER_HUB_TRACKER_ID);
  if (!trackerId.success)
    return json(
      {
        error:
          "Saved Miller rankings are unavailable: tracker configuration is missing.",
        code: "missing_tracker_configuration",
      },
      503,
    );
  try {
    const snapshot = await loadSnapshot(trackerId.data);
    return json(
      url.searchParams.has("history") ? { pulls: [snapshot] } : snapshot,
      200,
      true,
    );
  } catch (cause) {
    return json(
      {
        error: "Saved Miller rankings are unavailable.",
        code:
          cause instanceof FeedDataError
            ? cause.code
            : "saved_tracker_read_failed",
      },
      503,
    );
  }
}
