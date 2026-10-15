import { describe, expect, it } from "vitest";
import {
  channelLabel,
  formatChange,
  formatCheckedAt,
  formatOffsiteCount,
  groupSnapshotsByMonth,
  statusLabel,
} from "./overviewOffsite";

describe("formatOffsiteCount", () => {
  it("groups thousands", () => {
    expect(formatOffsiteCount(12345)).toBe("12,345");
    expect(formatOffsiteCount(0)).toBe("0");
  });
  it("says so when the provider returned nothing", () => {
    expect(formatOffsiteCount(null)).toBe("Not reported");
  });
});

describe("formatCheckedAt", () => {
  it("prints Central Time", () => {
    expect(formatCheckedAt("2026-10-15T20:04:00Z")).toBe(
      "Oct 15, 2026, 3:04 PM CDT",
    );
  });
  it("returns null for junk", () => {
    expect(formatCheckedAt("nope")).toBeNull();
  });
});

const snap = (snapshotDate: string, referringDomains: number | null) => ({
  snapshotDate,
  referringDomains,
  backlinks: null,
  checkedAt: `${snapshotDate}T15:00:00.000Z`,
});

describe("groupSnapshotsByMonth", () => {
  it("keeps the last snapshot of each month and compares to the month before", () => {
    const rows = groupSnapshotsByMonth([
      snap("2026-10-15", 12),
      snap("2026-08-03", 5),
      snap("2026-10-02", 9),
      snap("2026-08-28", 8),
      snap("2026-09-10", 8),
    ]);
    expect(rows.map((r) => [r.label, r.referringDomains, r.change])).toEqual([
      ["Oct 2026", 12, "+4"],
      ["Sep 2026", 8, "No change"],
      ["Aug 2026", 8, "first snapshot"],
    ]);
    expect(rows[0]?.checkedDate).toBe("Oct 15, 2026");
  });
  it("returns nothing for no snapshots", () => {
    expect(groupSnapshotsByMonth([])).toEqual([]);
  });
});

describe("formatChange", () => {
  it("shows signed differences", () => {
    expect(formatChange(3, 5)).toBe("-2");
    expect(formatChange(5, 3)).toBe("+2");
    expect(formatChange(null, 3)).toBe("Not comparable");
    expect(formatChange(3, undefined)).toBe("first snapshot");
  });
});

describe("labels", () => {
  it("uses plain words", () => {
    expect(statusLabel("link_live")).toBe("Link is live");
    expect(channelLabel("senior_living")).toBe("Senior living");
    expect(channelLabel("mystery")).toBe("mystery");
  });
});
