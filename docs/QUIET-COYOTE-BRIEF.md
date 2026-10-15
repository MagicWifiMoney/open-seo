# Brief: turn our OpenSEO fork into the Quiet Coyote SEO dashboard

Paste this whole file to the design/build agent. Read it fully before touching code.

## Goal
Rebrand and extend our fork of OpenSEO as Quiet Coyote's own tool. Local-business SEO first (Miller Estate Solutions is the first client, Twin Cities estate liquidation). Done looks like: no visible "OpenSEO" anywhere a user can see, Quiet Coyote logo and colors everywhere, and a new Overview dashboard that tells a clear story for a local business.

## What we are working on
- Repo: `~/code/active/app-flare/open-seo` (fork of OpenSEO, MIT, remote `MagicWifiMoney/open-seo`). Work on a new branch `quiet-coyote/<task>` off `miller/competitor-tracking`. Never commit to main, never push without Jake saying so.
- Stack: TanStack Start + React 19, TanStack Router (file routes in `src/routes`, app pages under `src/routes/_app/p/$projectId`), Tailwind 4 + shadcn (`components.json`), recharts for charts, Cloudflare Worker + D1, Drizzle (`drizzle/`).
- Styles/tokens: `src/client/styles/app.css`. Layout/nav: `src/client/layout`, `src/client/navigation`. Static icons: `src/public/` (favicons, `transparent-logo.png`, webmanifest).
- Live (behind Cloudflare Access, Jake deploys): https://open-seo-miller.magicwifimoney.workers.dev

## Hard rules
- MIT license: keep `LICENSE` and its copyright notice (Ben Senescu) untouched. Add "Built on OpenSEO (MIT)" only in the repo README/LICENSE area, not in the UI.
- Never run any deploy (`alchemy`, `wrangler deploy`, `vercel`). Jake deploys. Do not spend DataForSEO or any API credits; use the existing data or fixtures.
- No secrets in files or chat. Env lives in Doppler / `.env.miller`; do not read or print it.
- Miller is a client: nothing is shown to or shared with them without Jake approving that specific item. Do not add public/share links.
- Copy: no em dashes, no emojis, no invented numbers (use real data or `[placeholder]`).
- Before handing back: `pnpm exec tsc --noEmit`, `pnpm exec oxlint`, and the test suite must pass (231 files, 1613 tests at last count). Give a diff summary and screenshots.
- Do not change migrations or the DataForSEO/GSC/GA4 server code unless the task says so.

## Task 1: Rebrand (do first, small PR)
1. Replace the product name in every user-visible string with "Quiet Coyote". About 228 occurrences of "OpenSEO" under `src/`; classify each: UI text, page titles, emails, share/report pages (`src/server/features/reports/sharePage.tsx`, `reportSocialImage.tsx`), the AI assistant prompt (`src/server/features/sam/`), MCP/OAuth consent text. Leave internal identifiers, package names, import paths, test fixtures, and the `open-seo-miller` Worker name alone.
2. Logo and favicons: replace everything in `src/public/` and the in-app logo with the Quiet Coyote mark. Jake supplies the SVG/PNG at `docs/brand/` (if the folder is empty, stop and ask; do not invent a logo).
3. Theme: set Quiet Coyote colors, radius and fonts as tokens in `src/client/styles/app.css` (light and dark). Jake supplies the palette; if none is given, propose one and wait for approval.
4. Page `<title>`s, OG image, webmanifest name, sign-in pages, 404/empty states.
5. Remove or hide upsell surfaces that do not apply to self-hosted: billing, subscribe, YC page, "upgrade" prompts, support links to the upstream project.

## Task 2: Overview dashboard (the main page for a project)
A local-business first screen at `src/routes/_app/p/$projectId` index. Order matters, most important first:
1. Headline row: Search Console clicks and impressions (28 days vs previous), average position, and a launch marker (a configurable "site launched" date drawn on the trend charts).
2. Rank movement: keywords gained/lost/new in top 3 and top 10 since last check, from the rank tracker data already in D1.
3. Local visibility: Google Business Profile card (rating, review count, photo count, last review date) and a per-city table (city, Miller's best position, ranking page).
4. Competitors: who is ahead on how many tracked keywords, with the competitor grid link.
5. AI visibility: share of answers that name us, by engine and by topic, plus the competitor comparison, from the AI tracker.
6. Top pages and new pages with impressions since launch.
Everything reads existing server functions or D1 tables first; add new server functions only if a number is not available, and mark each in the PR.

## Task 3: Widgets and polish
- A DataForSEO balance and spend card exists (`DataforseoSpendCard.tsx`); fix the 24h number (reads `day.total` as a number, current code reads `total_<fn>` keys and shows $0).
- Cost calculator in the rank-tracking config modal exists; keep it prominent everywhere a paid action starts.
- Empty-state copy in the competitor grid wrongly says competitor positions cost nothing extra; fix.
- Make every chart and table readable at phone width and print cleanly (these become report pages).
- Add a "Print / save as PDF" friendly report view reusing the Overview components (no sharing link; Jake approves each report).

## Out of scope
GoHighLevel integration (dropped), anything that sends email or posts publicly, billing, changing auth.

## Handback format
Branch name, commits, what changed per task, screenshots (desktop and phone) of each changed page, test/lint/tsc output tail, and a list of anything you were unsure about.
