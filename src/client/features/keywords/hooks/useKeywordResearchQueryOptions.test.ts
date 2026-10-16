import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

vi.mock("cloudflare:workers", () => ({ env: {} }));

const { researchKeywords } = vi.hoisted(() => ({
  researchKeywords: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@/serverFunctions/keywords", () => ({ researchKeywords }));

import {
  buildKeywordResearchQueryOptions,
  buildKeywordResearchRequest,
} from "./useKeywordResearchData";

const request = buildKeywordResearchRequest({
  projectId: "project_1",
  keywordInput: "plumber",
  locationCode: 2840,
  locationName: undefined,
  resultLimit: 150,
  mode: "auto",
  clickstream: false,
  groupKeywords: false,
});

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("keyword research query for a role that cannot spend", () => {
  it("never calls researchKeywords", async () => {
    researchKeywords.mockClear();
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      buildKeywordResearchQueryOptions(request, false),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    await settle();
    unsubscribe();
    expect(researchKeywords).not.toHaveBeenCalled();
  });

  it("calls researchKeywords for a role that can spend", async () => {
    researchKeywords.mockReset();
    researchKeywords.mockResolvedValue({ rows: [] });
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      buildKeywordResearchQueryOptions(request, true),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    await settle();
    unsubscribe();
    expect(researchKeywords).toHaveBeenCalledTimes(1);
  });
});
