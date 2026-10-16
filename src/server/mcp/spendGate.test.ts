import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { SPEND_MCP_TOOLS } from "@/server/auth/spendFunctions";
import { SPEND_NOT_ALLOWED_MESSAGE } from "@/server/auth/spendFunctions";
import { createOpenSeoMcpServer } from "@/server/mcp/server";
import { makeToolContext } from "@/server/mcp/tools/tool-test-support";

vi.mock("cloudflare:workers", () => ({
  env: {},
  waitUntil: vi.fn(),
  DurableObject: class {
    kind = "mock";
  },
}));

const toolsDir = resolve(__dirname, "tools");
const sources = readdirSync(toolsDir)
  .filter((file) => file.endsWith(".ts") && !file.includes(".test."))
  .map((file) => readFileSync(resolve(toolsDir, file), "utf8"));

function markedSpend(): string[] {
  return sources.flatMap((source) =>
    [...source.matchAll(/name: "([a-z_]+)",\s*spend: true,/g)].map(
      (match) => match[1],
    ),
  );
}

describe("MCP spend tools", () => {
  it("marks exactly the listed tools with spend: true in source", () => {
    expect(new Set(markedSpend())).toEqual(new Set(SPEND_MCP_TOOLS));
  });

  describe("registered server", () => {
    it.each(SPEND_MCP_TOOLS)("refuses %s for a client", async (name) => {
      const client = makeToolContext({ role: "client" });
      const register = vi.spyOn(McpServer.prototype, "registerTool");
      createOpenSeoMcpServer({ openSeoAuth: client.auth });
      const callback = register.mock.calls.find(([n]) => n === name)?.[2];
      register.mockRestore();
      if (typeof callback !== "function")
        throw new Error(`${name} not registered`);
      await expect(
        Reflect.apply(callback, undefined, [{}, { http: {} }]),
      ).rejects.toThrow(SPEND_NOT_ALLOWED_MESSAGE);
    });
  });
});
