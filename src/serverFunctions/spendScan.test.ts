import { describe, expect, it } from "vitest";
import {
  FREE_DESPITE_IMPORT,
  SPEND_MCP_TOOLS,
  SPEND_SERVER_FUNCTIONS,
  SPEND_SPLIT_SERVER_FUNCTIONS,
} from "@/server/auth/spendFunctions";
import {
  PAID_MARKERS,
  listSources,
  mcpToolsInFile,
  paidServerFunctions,
} from "@/server/auth/spendScan";

// Not circular: the paid entry points are found by scanning the source, not
// read from the gated lists, so a new handler that reaches DataForSEO, a paid
// workflow or the chat model fails here until it is gated or explicitly
// listed as free with a reason.

const gated = new Set([
  ...Object.values(SPEND_SERVER_FUNCTIONS).flat(),
  ...Object.values(SPEND_SPLIT_SERVER_FUNCTIONS).flat(),
]);
const gatedTools = new Set<string>(SPEND_MCP_TOOLS);

function unaccountedServerFunctions() {
  return listSources("src/serverFunctions").flatMap((file) =>
    paidServerFunctions(file)
      .filter(
        (name) =>
          !gated.has(name) && !(`${file}:${name}` in FREE_DESPITE_IMPORT),
      )
      .map((name) => `${file}:${name}`),
  );
}

function unaccountedTools() {
  return listSources("src/server/mcp/tools").flatMap((file) => {
    const { names, paid } = mcpToolsInFile(file);
    if (!paid) return [];
    return names
      .filter(
        (name) =>
          !gatedTools.has(name) && !(`${file}:${name}` in FREE_DESPITE_IMPORT),
      )
      .map((name) => `${file}:${name}`);
  });
}

describe("paid-path source scan", () => {
  it("watches the known paid entry points", () => {
    expect(PAID_MARKERS).toEqual([
      "createDataforseoClient",
      "meterDataforseoCall",
      "SITE_AUDIT_WORKFLOW",
      "RANK_CHECK_WORKFLOW",
      "AI_VISIBILITY_WORKFLOW",
      "buildChatAgentModel",
    ]);
  });

  it("finds paid server functions (sanity: the scanner is not blind)", () => {
    const found = paidServerFunctions("src/serverFunctions/keywords.ts");
    expect(found).toContain("researchKeywords");
    expect(found).toContain("getSerpAnalysis");
  });

  it("every server function that reaches paid work is gated or listed free", () => {
    expect(unaccountedServerFunctions()).toEqual([]);
  });

  it("every MCP tool in a paid-reaching file is gated or listed free", () => {
    expect(unaccountedTools()).toEqual([]);
  });

  it("free-despite-import entries are not stale or contradictory", () => {
    const sfNames = new Set(
      listSources("src/serverFunctions").flatMap((file) =>
        paidServerFunctions(file).map((name) => `${file}:${name}`),
      ),
    );
    const toolNames = new Set(
      listSources("src/server/mcp/tools").flatMap((file) =>
        mcpToolsInFile(file).names.map((name) => `${file}:${name}`),
      ),
    );
    for (const [key, reason] of Object.entries(FREE_DESPITE_IMPORT)) {
      expect(reason.length, key).toBeGreaterThan(5);
      expect(sfNames.has(key) || toolNames.has(key), `stale: ${key}`).toBe(
        true,
      );
      const name = key.split(":")[1];
      expect(gated.has(name) || gatedTools.has(name), `gated: ${key}`).toBe(
        false,
      );
    }
  });
});
