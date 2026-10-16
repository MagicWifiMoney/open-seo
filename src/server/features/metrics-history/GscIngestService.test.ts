import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/runBatch", () => ({ runBatch: vi.fn() }));

const { gscRowsToDaily } = await import("./GscIngestService");

const metrics = { clicks: 3, impressions: 30, ctr: 0.1, position: 4.2 };

describe("gscRowsToDaily", () => {
  it("maps [date] rows to site rows with an empty device", () => {
    const out = gscRowsToDaily(
      ["date"],
      [{ keys: ["2026-01-01"], ...metrics }],
      "2026-01-05",
    );
    expect(out.site).toEqual([
      { date: "2026-01-01", device: "", ...metrics, finalized: true },
    ]);
    expect(out.page).toEqual([]);
  });

  it("reads keys positionally for [date, device]", () => {
    const out = gscRowsToDaily(
      ["date", "device"],
      [{ keys: ["2026-01-01", "MOBILE"], ...metrics }],
      "2026-01-05",
    );
    expect(out.site[0]).toMatchObject({ date: "2026-01-01", device: "MOBILE" });
  });

  it("maps [date, page] rows to page rows", () => {
    const out = gscRowsToDaily(
      ["date", "page"],
      [{ keys: ["2026-01-01", "https://x.test/a"], ...metrics }],
      "2026-01-05",
    );
    expect(out.page[0]).toMatchObject({ page: "https://x.test/a" });
  });

  it("maps [date, query, page, device] by position, not by name order", () => {
    const out = gscRowsToDaily(
      ["date", "query", "page", "device"],
      [{ keys: ["2026-01-01", "red shoes", "/shoes", "DESKTOP"], ...metrics }],
      "2026-01-05",
    );
    expect(out.queryPage[0]).toMatchObject({
      query: "red shoes",
      page: "/shoes",
      device: "DESKTOP",
    });
  });

  it("marks only dates on or before the cutoff as finalized", () => {
    const out = gscRowsToDaily(
      ["date"],
      ["2026-01-04", "2026-01-05", "2026-01-06"].map((d) => ({
        keys: [d],
        ...metrics,
      })),
      "2026-01-05",
    );
    expect(out.site.map((r) => r.finalized)).toEqual([true, true, false]);
  });

  it("skips rows without a date key", () => {
    expect(
      gscRowsToDaily(["date"], [{ ...metrics }], "2026-01-05").site,
    ).toEqual([]);
  });
});
