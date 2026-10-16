import { SPEND_NOT_ALLOWED_REASON } from "@/server/auth/spendFunctions";
import { AppError } from "@/server/lib/errors";

// Roles without research:spend can add tracking keywords, but every keyword on
// an owner-scheduled config grows scheduled spend, so additions are capped.
export const CLIENT_KEYWORDS_PER_DAY = 20;
export const CLIENT_KEYWORD_CAP_MESSAGE = `You can add up to ${CLIENT_KEYWORDS_PER_DAY} keywords a day. Ask the workspace owner for more.`;

function parseCreatedAt(value: string): number {
  // D1 stores "YYYY-MM-DD HH:MM:SS" in UTC; Postgres stores ISO.
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
}

/**
 * Throws FORBIDDEN when adding `incoming` would push the config past the daily
 * cap. Counts keywords created on the config in the last 24h (no per-actor
 * marker exists, so owner additions count too, which errs toward the cap) plus
 * the incoming keywords that are genuinely new.
 */
export function assertClientKeywordBudget(input: {
  existing: Array<{ keyword: string; createdAt: string }>;
  incoming: string[];
  matchCase?: boolean;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const known = new Set(input.existing.map((row) => row.keyword));
  const fresh = new Set<string>();
  for (const raw of input.incoming) {
    const trimmed = raw.trim();
    const keyword = input.matchCase ? trimmed : trimmed.toLowerCase();
    if (keyword && !known.has(keyword)) fresh.add(keyword);
  }
  const recent = input.existing.filter(
    (row) => now - parseCreatedAt(row.createdAt) < 86_400_000,
  ).length;
  if (recent + fresh.size > CLIENT_KEYWORDS_PER_DAY) {
    throw new AppError("FORBIDDEN", CLIENT_KEYWORD_CAP_MESSAGE, {
      reason: SPEND_NOT_ALLOWED_REASON,
    });
  }
}
