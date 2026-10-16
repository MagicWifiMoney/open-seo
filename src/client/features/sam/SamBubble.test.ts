import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The suite runs in a node environment with no DOM library, so the bubble is
// rendered to markup. Only the three things that decide what it shows are
// mocked: SAM access, the current path, and the sheet itself.
const state = vi.hoisted(() => ({
  access: { status: "ready" } as { status: string },
  pathname: "/p/abc/keywords",
}));

vi.mock("./useSamAccess", () => ({ useSamAccess: () => state.access }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: state.pathname }),
  Link: () => null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({}),
  useMutation: () => ({}),
}));
vi.mock("@/serverFunctions/sam", () => ({ createSamSession: vi.fn() }));
vi.mock("./SamConversation", () => ({ SamConversation: () => null }));
vi.mock("./samBetaOptIn", () => ({ optInToSamBeta: vi.fn() }));
vi.mock("@/client/features/sam/samQueries", () => ({
  invalidateSamSessions: vi.fn(),
  samSessionsQueryOptions: vi.fn(),
}));

import { SamBubble } from "./SamBubble";

const render = () =>
  renderToStaticMarkup(createElement(SamBubble, { projectId: "abc" }));

describe("SamBubble", () => {
  beforeEach(() => {
    state.access = { status: "ready" };
    state.pathname = "/p/abc/keywords";
  });

  it("renders the trigger when SAM access is ready", () => {
    const html = render();
    expect(html).toContain('aria-label="Chat with your data"');
    // Closed by default: the sheet content is not mounted yet.
    expect(html).not.toContain("Ask about your data");
  });

  it.each(["checking", "setup", "error"])(
    "renders nothing when access is %s",
    (status) => {
      state.access = { status };
      expect(render()).toBe("");
    },
  );

  it("renders nothing on the full SAM page", () => {
    state.pathname = "/p/abc/sam";
    expect(render()).toBe("");
  });
});
