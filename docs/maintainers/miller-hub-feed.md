# Miller Hub saved rank feed

This draft adds `GET /api/public/miller-scoreboard` to the dedicated Miller Worker. It is disabled unless `MILLER_HUB_FEED_ENABLED` is exactly `true`, `AUTH_MODE` is `cloudflare_access`, and the original HTTPS request host is exactly `open-seo-miller.magicwifimoney.workers.dev`. No localhost or forwarded-host bypass exists.

The only optional query is `history=1`, which returns `{ pulls: [snapshot] }`. There is one saved campaign snapshot, not an invented historical series. All other query parameters and non-GET methods are rejected before database reads.

## Before activation

Publishing and any Access policy changes require Jake's per-item approval. This change does not modify deployment configuration, live environment variables, Access applications, schedules, secrets or provider credentials.

1. Read the dedicated Miller database, without modifying it, and verify tracker `dd63719c-2cea-460e-ba5a-a369c772fba4` belongs to project `a3a7dde6-d78e-4912-bb18-d681a725392f`, domain `millerestatesolutions.com`, location `Minneapolis-St. Paul, MN, United States`, both devices and the intended depth/schedule. Do not select the separate national tracker.
2. After approval, set `MILLER_HUB_TRACKER_ID` to that verified tracker UUID and `MILLER_HUB_FEED_ENABLED=true` on the dedicated Miller deployment only. The code still rechecks the fixed project and domain before reading saved results.
3. After approval, configure an Access exception for the exact path `/api/public/miller-scoreboard` on the dedicated Miller hostname only. Preserve Access authentication on every other path, including `/mcp`, app pages and other APIs. Do not create a broad `/api/public/*` or host-wide bypass. Query strings do not broaden the path exception.
4. Verify an unauthenticated GET returns only the Miller scoreboard whitelist. Verify `history=1`, write-method rejection, unsupported-query rejection, cache headers and saved check dates. Verify all other paths still require Access login. Connect the Hub's server-side fetch to this URL; no browser CORS exception is needed.
5. To hold or disable the feed, unset the enable variable or set it to `false`. Errors have `Cache-Control: no-store`; successful snapshots have `public, max-age=60, s-maxage=300`, so allow cached successes to expire after disabling.

## Data contract

The v1 Hub scoreboard contains actual stored keyword/device positions, saved timestamps, selected tracking settings and a campaign UUID. Checked-with-no-position is `out`; no saved device snapshot is `unchecked`. Overall rows are ranked when any selected device has a rank, unchecked when an unranked row lacks any selected device check, otherwise out. Individual device timestamps preserve mixed check dates. The newest saved result sets `asOf`; an incomplete/failed latest run or a saved device result older than eight days marks the snapshot stale.

Ranking URLs are HTTPS Miller domain URLs with query strings and fragments removed. Account/project/user IDs, raw provider data, provider errors, unrelated metrics and secrets are excluded. Estimated traffic, visibility score and AI values remain null. Movers and competitors are empty because this feed does not establish a reliable comparison series. No DataForSEO request, paid operation, queue, run trigger or mutation is reachable through this handler.

The existing app and MCP rank-tracker entry points continue to use their authenticated services. This endpoint reads the same completed-run snapshot repository but does not reuse a trigger path.

Run focused verification with `pnpm exec vitest run src/server/features/rank-tracking/services/millerHubFeed.test.ts src/server/millerHubFeedRoute.test.ts`.
