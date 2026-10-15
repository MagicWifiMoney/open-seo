import type { KpiKey } from "./overviewMetrics";

/** Plain-language "what this means" text, shown on every metric card. No
 *  dollar value is estimated anywhere: there is no revenue source. */
export const KPI_COPY: Record<
  KpiKey,
  { label: string; source: string; short: string; meaning: string }
> = {
  keyEvents: {
    label: "Key events",
    source: "Google Analytics, organic search visits",
    short: "GA4",
    meaning:
      "Actions you marked as important in Google Analytics, such as a form sent or a call button tapped, counted for visits that came from search. No dollar value is estimated.",
  },
  sessions: {
    label: "Organic visits",
    source: "Google Analytics, organic search channel",
    short: "GA4",
    meaning:
      "Visits to the site that started from an unpaid search result. One person can visit more than once.",
  },
  clicks: {
    label: "Clicks from Google",
    source: "Google Search Console",
    short: "GSC",
    meaning:
      "How many times someone clicked through to the site from Google Search results.",
  },
  impressions: {
    label: "Times shown in Google",
    source: "Google Search Console",
    short: "GSC",
    meaning:
      "How many times the site appeared in Google Search results, whether or not anyone clicked.",
  },
  position: {
    label: "Average position",
    source: "Google Search Console",
    short: "GSC",
    meaning:
      "Where the site usually appears in Google results. 1 is the very top, so a lower number is better.",
  },
};

export const COVERAGE_MEANING =
  "How many of the tracked search phrases the latest check actually looked up. If it is less than all of them, the counts below can undercount.";
