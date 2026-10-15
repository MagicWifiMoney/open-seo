import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Switch } from "@/client/components/ui/switch";
import { isValidIsoDate } from "@/types/schemas/traffic";
import {
  OVERVIEW_COMPARES,
  OVERVIEW_RANGES,
  type OverviewCompare,
  type OverviewRange,
} from "@/types/schemas/overview";
import { COMPARE_LABELS, RANGE_LABELS } from "./overviewRange";

type RangeCompareValue = {
  range: OverviewRange;
  compare: OverviewCompare;
  launch: string;
  from?: string;
  to?: string;
  marker: boolean;
};

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
        <SelectTrigger size="sm" className="w-full sm:w-52" aria-label={label}>
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

/** The shared date range and compare control. All state is URL search params
 *  (range, compare, from, to, launch, marker), so any page can read the same
 *  names and a link keeps the view. */
export function RangeCompareControl({
  value,
  onChange,
}: {
  value: RangeCompareValue;
  onChange: (update: Partial<RangeCompareValue>) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 print:hidden">
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <LabeledSelect
          label="Date range"
          values={OVERVIEW_RANGES}
          labels={RANGE_LABELS}
          value={value.range}
          onChange={(range) => onChange({ range })}
        />
        <LabeledSelect
          label="Compare with"
          values={OVERVIEW_COMPARES}
          labels={COMPARE_LABELS}
          value={value.compare}
          onChange={(compare) => onChange({ compare })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Site launch date
          </span>
          <Input
            type="date"
            className="h-8 w-full sm:w-40"
            value={value.launch}
            onChange={(event) => {
              if (isValidIsoDate(event.target.value)) {
                onChange({ launch: event.target.value });
              }
            }}
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <Switch
            size="sm"
            checked={value.marker}
            onCheckedChange={(marker) => onChange({ marker })}
            aria-label="Show launch marker on charts"
          />
          Show launch marker
        </label>
      </div>
      {value.range === "custom" ? (
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          {(["from", "to"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {key === "from" ? "From" : "To"}
              </span>
              <Input
                type="date"
                className="h-8 w-full sm:w-40"
                value={value[key] ?? ""}
                onChange={(event) =>
                  onChange({
                    [key]: isValidIsoDate(event.target.value)
                      ? event.target.value
                      : undefined,
                  })
                }
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
