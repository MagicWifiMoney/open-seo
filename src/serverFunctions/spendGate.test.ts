import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { requireSpend } from "@/server/auth/org-gate";
import {
  SPEND_NOT_ALLOWED_MESSAGE,
  SPEND_SERVER_FUNCTIONS,
  SPEND_SPLIT_SERVER_FUNCTIONS,
} from "@/server/auth/spendFunctions";
import { AppError } from "@/server/lib/errors";

// Law 12: these tests read the real source files, so a spending handler that
// loses its gate (or a new one that is never listed) fails here.
const root = resolve(__dirname, "../..");

function handlerBody(file: string, name: string) {
  const source = readFileSync(resolve(root, file), "utf8");
  const start = source.indexOf(`export const ${name} = createServerFn`);
  expect(start, `${name} not found in ${file}`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport ", start + 1);
  const end = next === -1 ? source.length : next;
  const chunk = source.slice(start, end);
  const handler = chunk.indexOf(".handler(");
  expect(handler, `${name} has no handler`).toBeGreaterThanOrEqual(0);
  return chunk.slice(handler);
}

describe("requireSpend", () => {
  it("throws FORBIDDEN with the spend message for client", () => {
    let thrown: unknown;
    try {
      requireSpend({ role: "client" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown).toMatchObject({
      code: "FORBIDDEN",
      message: SPEND_NOT_ALLOWED_MESSAGE,
      details: { reason: "SPEND_NOT_ALLOWED" },
    });
  });
  it.each(["owner", "admin", "member"])("allows %s", (role) => {
    expect(() => requireSpend({ role })).not.toThrow();
  });
  it("fails closed for unknown roles", () => {
    expect(() => requireSpend({ role: "mystery" })).toThrow();
  });
});

describe("spending server functions", () => {
  const cases = Object.entries(SPEND_SERVER_FUNCTIONS).flatMap(
    ([file, names]) => names.map((name) => [name, file] as const),
  );

  it.each(cases)(
    "%s calls requireSpend before any other work",
    (name, file) => {
      const body = handlerBody(file, name);
      const gate = body.indexOf("requireSpend(context)");
      expect(gate).toBeGreaterThan(-1);
      // The gate is the first statement of the handler body.
      const open = body.indexOf("{", body.indexOf("=>"));
      expect(body.slice(open + 1, gate).trim()).toBe("");
    },
  );

  const splitCases = Object.entries(SPEND_SPLIT_SERVER_FUNCTIONS).flatMap(
    ([file, names]) => names.map((name) => [name, file] as const),
  );

  it.each(splitCases)("%s branches on canSpend", (name, file) => {
    expect(handlerBody(file, name)).toContain("canSpend(context.role)");
  });

  it("rank tracking reports spendSkipped for clients", () => {
    for (const name of ["createRankTrackingConfig", "addTrackingKeywords"]) {
      expect(
        handlerBody("src/serverFunctions/rank-tracking.ts", name),
      ).toContain("spendSkipped");
    }
  });

  it("no server function file calls a paid service without being listed", () => {
    // Any handler that touches these paid entry points must be in a list.
    const listed = new Set(
      [
        ...Object.entries(SPEND_SERVER_FUNCTIONS),
        ...Object.entries(SPEND_SPLIT_SERVER_FUNCTIONS),
      ].flatMap(([, names]) => names),
    );
    const paid = [
      "KeywordResearchService.research",
      "KeywordResearchService.refreshSavedKeywordMetrics",
      "BacklinksService.profile",
      "AuditService.startAudit",
      "RankTrackingService.triggerCheck",
      "RankTrackingService.refreshKeywordMetrics",
      "AiVisibilityService.runCheck",
    ];
    for (const file of new Set([
      ...Object.keys(SPEND_SERVER_FUNCTIONS),
      ...Object.keys(SPEND_SPLIT_SERVER_FUNCTIONS),
    ])) {
      const source = readFileSync(resolve(root, file), "utf8");
      for (const match of source.matchAll(
        /export const (\w+) = createServerFn/g,
      )) {
        const name = match[1];
        const body = handlerBody(file, name);
        if (paid.some((call) => body.includes(call))) {
          expect(listed.has(name), `${name} spends but is not listed`).toBe(
            true,
          );
        }
      }
    }
  });
});
