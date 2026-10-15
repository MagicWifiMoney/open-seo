import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import {
  TRAFFIC_CHANNELS,
  TRAFFIC_GRANULARITIES,
  TRAFFIC_METRICS,
  TRAFFIC_RANGES,
  isValidIsoDate,
  type TrafficSearch,
} from "@/types/schemas/traffic";
import {
  CHANNEL_LABELS,
  GRANULARITY_LABELS,
  METRIC_LABELS,
  RANGE_LABELS,
} from "./trafficFormat";

function items<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
) {
  return values.map((value) => ({ value, label: labels[value] }));
}

function find<T extends string>(values: readonly T[], value: string | null) {
  return values.find((option) => option === value);
}

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
  const options = items(values, labels);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          const match = find(values, next);
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

/** Range, metric, channel, granularity and launch-date controls. All state
 *  lives in the URL. */
export function TrafficControls({
  search,
  coverage,
  onSearchChange,
}: {
  search: TrafficSearch;
  coverage: { start: string; end: string } | null;
  onSearchChange: (update: Partial<TrafficSearch>) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 print:hidden">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <LabeledSelect
          label="Date range"
          values={TRAFFIC_RANGES}
          labels={RANGE_LABELS}
          value={search.range}
          onChange={(range) => onSearchChange({ range })}
        />
        <LabeledSelect
          label="Channel"
          values={TRAFFIC_CHANNELS}
          labels={CHANNEL_LABELS}
          value={search.channel}
          onChange={(channel) => onSearchChange({ channel })}
        />
        <LabeledSelect
          label="Group by"
          values={TRAFFIC_GRANULARITIES}
          labels={GRANULARITY_LABELS}
          value={search.granularity}
          onChange={(granularity) => onSearchChange({ granularity })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Site launch date
          </span>
          <Input
            type="date"
            className="h-8 w-full sm:w-40"
            value={search.launch}
            onChange={(event) => {
              if (isValidIsoDate(event.target.value)) {
                onSearchChange({ launch: event.target.value });
              }
            }}
          />
        </label>
      </div>
      {search.range === "custom" ? (
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              From
            </span>
            <Input
              type="date"
              className="h-8 w-full sm:w-40"
              value={search.from ?? coverage?.start ?? ""}
              min={coverage?.start}
              max={coverage?.end}
              onChange={(event) =>
                onSearchChange({
                  from: isValidIsoDate(event.target.value)
                    ? event.target.value
                    : undefined,
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              To
            </span>
            <Input
              type="date"
              className="h-8 w-full sm:w-40"
              value={search.to ?? coverage?.end ?? ""}
              min={coverage?.start}
              max={coverage?.end}
              onChange={(event) =>
                onSearchChange({
                  to: isValidIsoDate(event.target.value)
                    ? event.target.value
                    : undefined,
                })
              }
            />
          </label>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Metric
        </span>
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[search.metric]}
          onValueChange={(next) => {
            const metric = find(TRAFFIC_METRICS, next[0] ?? null);
            if (metric) onSearchChange({ metric });
          }}
          aria-label="Metric"
        >
          {TRAFFIC_METRICS.map((metric) => (
            <ToggleGroupItem key={metric} value={metric}>
              {METRIC_LABELS[metric]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
