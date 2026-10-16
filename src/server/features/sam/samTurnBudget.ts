import { canSpend } from "@/lib/org-permissions";

export const DEFAULT_CLIENT_DAILY_TURNS = 60;
export const CLIENT_TURN_LIMIT_MESSAGE =
  "You've reached today's chat limit; it resets at midnight UTC.";

type CounterStore = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
};

function dailyLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_CLIENT_DAILY_TURNS;
}

/**
 * Per-user daily SAM turn budget for roles that cannot spend (their chat is
 * open, but every turn is a paid OpenRouter call). Keyed by user and UTC date
 * in a store shared across sessions, so opening a new chat does not reset it.
 * Returns the canned refusal when over budget, else null after counting the
 * turn. The read-modify-write is not atomic; concurrent turns can overshoot by
 * a few, which is fine for a spend guard. Roles that can spend are never
 * counted.
 */
export async function clientTurnRefusal(input: {
  role: string;
  userId: string;
  store: CounterStore;
  limit?: string;
  now?: Date;
}): Promise<string | null> {
  if (canSpend(input.role)) return null;
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const key = `sam-client-turns:${input.userId}:${day}`;
  const used = Number.parseInt((await input.store.get(key)) ?? "0", 10) || 0;
  if (used >= dailyLimit(input.limit)) return CLIENT_TURN_LIMIT_MESSAGE;
  await input.store.put(key, String(used + 1), { expirationTtl: 2 * 86400 });
  return null;
}

/**
 * DO-facing wrapper: continuations of an already-counted turn are free, and a
 * refusal is recorded on the turn's telemetry as `client_cap`.
 */
export async function samClientTurnRefusal(
  auth: { role: string; userId: string },
  env: { KV: CounterStore; SAM_CLIENT_DAILY_TURNS?: string },
  turn: { continuation: boolean; refusal: string | null },
): Promise<string | null> {
  if (turn.continuation) return null;
  const refusal = await clientTurnRefusal({
    role: auth.role,
    userId: auth.userId,
    store: env.KV,
    limit: env.SAM_CLIENT_DAILY_TURNS,
  });
  if (refusal) turn.refusal = "client_cap";
  return refusal;
}
