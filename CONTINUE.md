# CONTINUE (fork)

## State (2026-10-16 ~17:30 CT)
- LIVE on open-seo-miller: branch quiet-coyote/client-access (= quiet-coyote/miller-hub-feed-live). Deployed by claude-code, 6 resources, Access policy now allows jake.giebel@gmail.com, quietcoyotemn@gmail.com and @millerestatesolutions.com; ACCESS_OWNER_EMAILS makes everyone else a `client` role.
- Client role: reads everything, saves keywords, adds up to 20 tracker keywords/day (no auto-check), creates trackers without schedule; every paid path (DataForSEO, audits, AI visibility runs, prompt generation, billing) throws the spend message; MCP/SAM tools mirror it; spendScan.test.ts fails if a new paid handler is unlisted.
- SAM chat bubble on every project page (bottom-right). Clients capped at SAM_CLIENT_DAILY_TURNS (default 60). BLOCKED: OpenRouter account has $0 credit (135 bought / 135.21 used); SAM replies "stopped before finishing" until Jake tops up. Key in .env.miller = Doppler shared/prd OPENROUTER_API_KEY__2.
- GSC Insights page rebuilt on stored gsc_daily_* rows (presets to 16 months, compare, device, buckets, movers, tables). Verified live in Chrome as owner.

## Next
- Jake: top up OpenRouter, then re-test the bubble. Send Charlie the invite (text in brain runbook docs/runbooks/openseo-client-access.md).
- Not yet verified with a real @millerestatesolutions.com login (no test account); role resolution is unit-tested.
- Known gaps: /billing, /settings, /context routes are hidden but reachable by URL for clients (no paid queries there). Controls on GSC Insights are not URL-persisted.
