import { Download } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  GSC_INSIGHTS_COMPARES,
  GSC_INSIGHTS_DEVICES,
  GSC_INSIGHTS_RANGES,
  type GscInsightsCompare,
  type GscInsightsDevice,
  type GscInsightsRange,
} from "@/types/schemas/gsc-insights";
import {
  COMPARE_LABELS,
  DEVICE_LABELS,
  RANGE_LABELS,
  formatDate,
} from "./insightsFormat";

function LabeledSelect<T extends string>({
  label,
  values,
  labels,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  const options = values.map((option) => ({
    value: option,
    label: labels[option],
  }));
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          const match = values.find((option) => option === next);
          if (match) onChange(match);
        }}
      >
        <SelectTrigger size="sm" className="w-full sm:w-40" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InsightsControls({
  range,
  compare,
  device,
  onRangeChange,
  onCompareChange,
  onDeviceChange,
  coverage,
  onExport,
}: {
  range: GscInsightsRange;
  compare: GscInsightsCompare;
  device: GscInsightsDevice;
  onRangeChange: (range: GscInsightsRange) => void;
  onCompareChange: (compare: GscInsightsCompare) => void;
  onDeviceChange: (device: GscInsightsDevice) => void;
  coverage: { end: string; finalizedThrough: string | null } | null;
  onExport: (() => void) | null;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <div
          role="group"
          aria-label="Date range"
          className="flex flex-wrap gap-1.5"
        >
          {GSC_INSIGHTS_RANGES.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={option === range ? "secondary" : "outline"}
              aria-pressed={option === range}
              onClick={() => onRangeChange(option)}
            >
              {RANGE_LABELS[option]}
            </Button>
          ))}
        </div>
        <LabeledSelect
          label="Compare"
          values={GSC_INSIGHTS_COMPARES}
          labels={COMPARE_LABELS}
          value={compare}
          onChange={onCompareChange}
        />
        <LabeledSelect
          label="Device"
          values={GSC_INSIGHTS_DEVICES}
          labels={DEVICE_LABELS}
          value={device}
          onChange={onDeviceChange}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="sm:ml-auto"
          disabled={!onExport}
          onClick={onExport ?? undefined}
        >
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
      </div>
      {coverage ? (
        <p className="text-xs text-muted-foreground">
          Data through {formatDate(coverage.end)}
          {coverage.finalizedThrough
            ? `, finalized through ${formatDate(coverage.finalizedThrough)}`
            : ", not yet finalized"}
          . Recent days can still shift as Google finalizes them.
        </p>
      ) : null}
    </div>
  );
}
