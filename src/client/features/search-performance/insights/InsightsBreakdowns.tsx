import type { GscInsights } from "@/types/schemas/gsc-insights";
import { DEVICE_LABELS, formatInt } from "./insightsFormat";

type Ready = Exclude<GscInsights, { coverage: null }>;

function Bar({
  segments,
  label,
}: {
  segments: { key: string; label: string; share: number; className: string }[];
  label: string;
}) {
  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={label}
        className="flex h-4 w-full overflow-hidden rounded-full bg-foreground/10"
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.className}
            style={{ width: `${segment.share * 100}%` }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${segment.className}`} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="ml-auto tabular-nums">
              {(segment.share * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BUCKETS = [
  { key: "top3", label: "Positions 1-3", className: "bg-success" },
  { key: "top10", label: "Positions 4-10", className: "bg-primary" },
  { key: "top20", label: "Positions 11-20", className: "bg-chart-2" },
  { key: "beyond", label: "Positions 21+", className: "bg-foreground/30" },
] as const;

function deviceLabel(device: string): string {
  return device === "desktop" || device === "mobile" || device === "tablet"
    ? DEVICE_LABELS[device]
    : device;
}

const DEVICE_CLASSES = ["bg-primary", "bg-chart-2", "bg-foreground/30"];

export function InsightsBreakdowns({
  positionBuckets,
  deviceSplit,
}: {
  positionBuckets: Ready["positionBuckets"];
  deviceSplit: Ready["deviceSplit"];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">Where impressions rank</h2>
          <p className="text-xs text-muted-foreground">
            Share of {formatInt(positionBuckets.total)} impressions by the
            position they appeared at.
          </p>
        </div>
        {positionBuckets.total > 0 ? (
          <Bar
            label="Impressions by ranking position"
            segments={BUCKETS.map((bucket) => ({
              ...bucket,
              share: positionBuckets.shares[bucket.key],
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No query-level data in this range.
          </p>
        )}
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">Device split</h2>
          <p className="text-xs text-muted-foreground">Share of clicks.</p>
        </div>
        {deviceSplit.length > 0 ? (
          <Bar
            label="Clicks by device"
            segments={deviceSplit.map((row, index) => ({
              key: row.device,
              label: deviceLabel(row.device),
              share: row.clicksShare,
              className: DEVICE_CLASSES[index % DEVICE_CLASSES.length],
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No device data in this range.
          </p>
        )}
      </section>
    </div>
  );
}
