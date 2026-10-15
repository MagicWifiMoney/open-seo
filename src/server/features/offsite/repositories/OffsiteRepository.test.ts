import { beforeEach, describe, expect, it, vi } from "vitest";
import { OffsiteRepository as repo } from "./OffsiteRepository";
import { chicagoDateOf } from "../offsiteDates";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("../../ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));

const base = { projectId: "project", organizationId: "organization" };

beforeEach(async () => {
  await testDb.seedProject();
});

describe("chicagoDateOf", () => {
  it("uses the Central Time calendar date", () => {
    expect(chicagoDateOf("2026-11-01T03:30:00Z")).toBe("2026-10-31");
    expect(chicagoDateOf("2026-10-15T20:04:00Z")).toBe("2026-10-15");
  });
});

describe("snapshots", () => {
  it("updates the same day instead of duplicating, newest first", async () => {
    const snap = (snapshotDate: string, referringDomains: number) => ({
      ...base,
      domain: "example.com",
      snapshotDate,
      referringDomains,
      backlinks: 10,
      checkedAt: `${snapshotDate}T15:00:00.000Z`,
    });
    await repo.saveSnapshot(snap("2026-09-30", 5));
    await repo.saveSnapshot(snap("2026-10-15", 7));
    await repo.saveSnapshot(snap("2026-10-15", 9));
    const rows = await repo.listSnapshots("project");
    expect(rows.map((r) => [r.snapshotDate, r.referringDomains])).toEqual([
      ["2026-10-15", 9],
      ["2026-09-30", 5],
    ]);
    expect(await repo.listSnapshots("other-project")).toEqual([]);
  });
});

describe("outreach log", () => {
  it("adds, updates and deletes only inside its project", async () => {
    const entry = await repo.addOutreach({
      ...base,
      targetName: "Smith Law",
      targetUrl: null,
      channel: "attorney",
      status: "planned",
      askedOn: null,
      linkedPageUrl: null,
      note: null,
    });
    expect(
      await repo.updateOutreach({
        projectId: "other-project",
        id: entry.id,
        status: "asked",
      }),
    ).toBeNull();
    const updated = await repo.updateOutreach({
      projectId: "project",
      id: entry.id,
      status: "asked",
      askedOn: "2026-10-15",
    });
    expect(updated).toMatchObject({ status: "asked", askedOn: "2026-10-15" });
    expect(updated?.targetName).toBe("Smith Law");
    await repo.deleteOutreach("other-project", entry.id);
    expect(await repo.listOutreach("project")).toHaveLength(1);
    await repo.deleteOutreach("project", entry.id);
    expect(await repo.listOutreach("project")).toHaveLength(0);
  });
});
