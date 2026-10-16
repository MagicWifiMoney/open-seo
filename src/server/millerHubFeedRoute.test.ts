import { expect, it, vi } from "vitest";
import worker from "@/server";

const mocks = vi.hoisted(() => ({
  feed: vi.fn(() => Promise.resolve(new Response("saved feed"))),
  app: vi.fn(),
  heartbeat: vi.fn(),
}));
vi.mock("@/server/features/rank-tracking/services/millerHubFeed", () => ({
  MILLER_HUB_FEED_PATH: "/api/public/miller-scoreboard",
  handleMillerHubFeed: mocks.feed,
}));
vi.mock("@tanstack/react-start/server", () => ({
  createStartHandler: () => mocks.app,
  defaultStreamHandler: vi.fn(),
}));
vi.mock("agents", () => ({ routeAgentRequest: vi.fn() }));
vi.mock("@/db", () => ({
  withPgClient: (callback: () => unknown) => callback(),
}));
vi.mock("@/middleware/ensure-user/resolve", () => ({
  resolveUserContextFromHeaders: vi.fn(),
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {},
}));
vi.mock("@/server/features/sam/SamSessionRepository", () => ({
  SamSessionRepository: {},
}));
vi.mock("@/server/features/rank-tracking/services/scheduledRankChecks", () => ({
  runScheduledRankChecks: vi.fn(),
}));
vi.mock("@/server/features/audit/services/auditReconciler", () => ({
  reconcileStaleAudits: vi.fn(),
}));
vi.mock("@/server/billing/subscription", () => ({
  getOrCreateOrganizationCustomer: vi.fn(),
}));
vi.mock("@/server/mcp/oauth-provider", () => ({
  createOpenSeoOAuthProvider: () => ({ fetch: mocks.app }),
}));
vi.mock("@/server/mcp/context", () => ({ MCP_ROUTE: "/mcp" }));
vi.mock("@/server/billing/autumn-webhook", () => ({
  AUTUMN_WEBHOOK_PATH: "/api/autumn",
  handleAutumnWebhookRequest: vi.fn(),
}));
vi.mock("@/server/referrals/dub", () => ({
  sweepDubReferredOrganizations: vi.fn(),
}));
vi.mock("@/server/lib/self-host-telemetry", () => ({
  maybeSendSelfHostHeartbeat: mocks.heartbeat,
}));
vi.mock("@/server/gdpr/storage-erasure", () => ({
  handleGdprStorageErasure: vi.fn(),
}));
vi.mock("@/server/workflows/RankCheckWorkflow", () => ({
  RankCheckWorkflow: class {},
}));
vi.mock("@/server/workflows/AiVisibilityWorkflow", () => ({
  AiVisibilityWorkflow: class {},
}));
vi.mock("@/server/features/sam/SamChatAgent", () => ({
  SamChatAgent: class {},
}));

it("wires only the exact public path before authentication and passes the original host", async () => {
  const req = new Request(
    "https://open-seo-miller.magicwifimoney.workers.dev/api/public/miller-scoreboard?history=1",
  );
  const env = { AUTH_MODE: "cloudflare_access" } as Env;
  const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
  expect(await (await worker.fetch(req, env, ctx)).text()).toBe("saved feed");
  expect(mocks.feed).toHaveBeenCalledWith(req, env);
  expect(mocks.app).not.toHaveBeenCalled();
  expect(mocks.heartbeat).not.toHaveBeenCalled();
  mocks.app.mockResolvedValue(new Response("authenticated app"));
  const other = new Request(
    "https://open-seo-miller.magicwifimoney.workers.dev/api/public/miller-scoreboard-extra",
  );
  expect(await (await worker.fetch(other, env, ctx)).text()).toBe(
    "authenticated app",
  );
  expect(mocks.feed).toHaveBeenCalledTimes(1);
});
