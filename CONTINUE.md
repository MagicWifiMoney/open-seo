# CONTINUE (fork, branch quiet-coyote/metrics-history → next branch quiet-coyote/client-access)

## Goal (Jake, 2026-10-16 ~13:50 CT)
Get open-seo-miller ready to send to Charlie (@millerestatesolutions.com) for access.
- Access: allow the whole @millerestatesolutions.com domain (Cloudflare Access emailDomain rule in deploy/alchemy); Jake + quietcoyotemn stay owners.
- Client role: can see every module/sidebar that has data (GSC insights, Traffic, rank tracking, AI prompt tracking, audits results, reports). Can add/save keywords. CANNOT trigger anything that charges Jake (DataForSEO research/metrics/SERP, rank tracker runs/creates, site audit runs, AI visibility runs, billing/top-up). Keep the keyword research field, show "credit spend not enabled for your account yet" instead of calling the API. Gate server-side (hasOrgPermission) AND hide/disable in UI.
- SAM chat bubble: floating button on project pages opening the existing SAM agent (OpenRouter key added to .env.miller from Doppler shared/prd OPENROUTER_API_KEY__2, $64 left on a $100 cap). Miller-flavoured system prompt.
- GSC insights tab: rebuild "way better" on the stored gsc_daily_* rows (16 months): trend chart, period compare, queries/pages tables with deltas, device split, position buckets.
- Not needed today but ship ready; Jake deploys are run by me (classifier may block `alchemy deploy --stage miller`; then hand Jake the command).

## State
- Live: open-seo-miller on quiet-coyote/miller-hub-feed-live == quiet-coyote/metrics-history (stored history live, proven).
- .env.miller now has OPENROUTER_API_KEY (not yet deployed).
- Research in flight: permission model + spend inventory; client UI map (GSC page, spend buttons, SAM mount).

## Next step
Write plan from the two research reports → worker PRs (server gate, UI role hiding, SAM bubble, GSC insights) → verifier → deploy to miller → send Charlie invite text.
