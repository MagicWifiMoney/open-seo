import { describe, expect, it } from "vitest";
import {
  CLIENT_TURN_LIMIT_MESSAGE,
  clientTurnRefusal,
  samClientTurnRefusal,
} from "./samTurnBudget";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    get: (key: string) => Promise.resolve(data.get(key) ?? null),
    put: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

const day1 = new Date("2026-10-16T23:59:00Z");
const day2 = new Date("2026-10-17T00:01:00Z");

describe("clientTurnRefusal", () => {
  it("allows turns up to the limit, then refuses with the canned reply", async () => {
    const store = memoryStore();
    const call = (userId = "u1", now = day1) =>
      clientTurnRefusal({ role: "client", userId, store, limit: "3", now });
    expect(await call()).toBeNull();
    expect(await call()).toBeNull();
    expect(await call()).toBeNull();
    expect(await call()).toBe(CLIENT_TURN_LIMIT_MESSAGE);
    expect(await call()).toBe(CLIENT_TURN_LIMIT_MESSAGE);
  });
  it("is per user and resets at midnight UTC", async () => {
    const store = memoryStore();
    const call = (userId: string, now: Date) =>
      clientTurnRefusal({ role: "client", userId, store, limit: "1", now });
    expect(await call("u1", day1)).toBeNull();
    expect(await call("u1", day1)).toBe(CLIENT_TURN_LIMIT_MESSAGE);
    expect(await call("u2", day1)).toBeNull();
    expect(await call("u1", day2)).toBeNull();
  });
  it("defaults to 60 turns a day", async () => {
    const store = memoryStore();
    for (let i = 0; i < 60; i++) {
      expect(
        await clientTurnRefusal({ role: "client", userId: "u", store }),
      ).toBeNull();
    }
    expect(
      await clientTurnRefusal({ role: "client", userId: "u", store }),
    ).toBe(CLIENT_TURN_LIMIT_MESSAGE);
  });
  it("never counts or limits roles that can spend", async () => {
    const store = memoryStore();
    for (let i = 0; i < 5; i++) {
      expect(
        await clientTurnRefusal({
          role: "owner",
          userId: "u",
          store,
          limit: "1",
        }),
      ).toBeNull();
    }
    expect(store.data.size).toBe(0);
  });
});

describe("samClientTurnRefusal", () => {
  it("records client_cap on the turn and skips continuations", async () => {
    const store = memoryStore();
    const env = { KV: store, SAM_CLIENT_DAILY_TURNS: "1" };
    const auth = { role: "client", userId: "u" };
    const turn = () => ({
      continuation: false,
      refusal: null as string | null,
    });
    expect(await samClientTurnRefusal(auth, env, turn())).toBeNull();
    const capped = turn();
    expect(await samClientTurnRefusal(auth, env, capped)).toBe(
      CLIENT_TURN_LIMIT_MESSAGE,
    );
    expect(capped.refusal).toBe("client_cap");
    const continued = { continuation: true, refusal: null };
    expect(await samClientTurnRefusal(auth, env, continued)).toBeNull();
  });
});
