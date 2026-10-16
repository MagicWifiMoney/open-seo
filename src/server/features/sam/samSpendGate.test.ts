import { describe, expect, it, vi } from "vitest";
import { SPEND_NOT_ALLOWED_MESSAGE } from "@/server/auth/spendFunctions";
import { buildSamMcpTools } from "@/server/features/sam/samChatTools";
import { makeToolContext } from "@/server/mcp/tools/tool-test-support";

vi.mock("cloudflare:workers", () => ({
  env: {},
  waitUntil: vi.fn(),
  DurableObject: class {
    kind = "mock";
  },
}));

const project = { id: "00000000-0000-4000-8000-000000000001", domain: "a.com" };
const options = { toolCallId: "t", messages: [] };

describe("SAM tools for a client", () => {
  const { auth } = makeToolContext({ role: "client" });
  const tools = buildSamMcpTools(auth, project);

  it("still offers the full tool set, so the chat turn proceeds", () => {
    expect(tools.run_site_audit).toBeDefined();
    expect(tools.list_saved_keywords).toBeDefined();
    expect(tools.get_product_info).toBeDefined();
  });

  it.each([
    ["run_site_audit", { url: "https://a.com" }],
    ["research_keywords", { keywords: ["x"] }],
    ["get_backlinks_overview", { target: "a.com" }],
    ["run_ai_visibility_check", {}],
  ])("refuses %s with the spend message", async (name, args) => {
    const result: unknown = await tools[name]?.execute?.(args, options);
    expect(result).toEqual({ error: SPEND_NOT_ALLOWED_MESSAGE });
  });

  it("runs a non-spending tool", async () => {
    const result: unknown = await tools.get_product_info?.execute?.(
      {},
      options,
    );
    expect(result).toHaveProperty("factSheet");
  });
});
