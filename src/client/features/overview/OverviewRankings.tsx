import { Link } from "@tanstack/react-router";
import { CardShell } from "@/client/components/CardShell";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Skeleton } from "@/client/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import { formatDay } from "@/client/features/traffic/trafficFormat";
import {
  OVERVIEW_DEVICES,
  type OverviewDevice,
} from "@/types/schemas/overview";
import { COVERAGE_MEANING } from "./overviewCopy";
import type { Mover, RankingsView } from "./overviewRankBands";
import type { useOverviewRankings } from "./useOverviewRankings";

type Rankings = ReturnType<typeof useOverviewRankings>;

/** Run timestamps are "YYYY-MM-DD HH:MM:SS" or ISO; the date part is enough. */
function runDay(checkedAt: string): string {
  return formatDay(checkedAt.slice(0, 10));
}

function changeText(count: number, before: number | null): string {
  if (before === null) return "No earlier complete run";
  const diff = count - before;
  if (diff === 0) return "No change";
  return `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)} from ${before}`;
}

function MoverList({
  title,
  movers,
  empty,
}: {
  title: string;
  movers: Mover[];
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-semibold">{title}</h4>
      {movers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {movers.map((mover) => (
            <li key={mover.keyword} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">{mover.keyword}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {mover.before} to {mover.now} ({mover.change > 0 ? "+" : ""}
                {mover.change})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-sm">
      <span className="font-semibold">{title}: </span>
      {names.join(", ")}
    </p>
  );
}

function Body({ view, device }: { view: RankingsView; device: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={view.partial ? "warning" : "success"}>
          Checked {view.checked} of {view.total} keywords
        </Badge>
        <span className="text-sm text-muted-foreground">
          Latest run {runDay(view.latest.checkedAt)}
          {view.previous
            ? `, compared with the previous complete run on ${runDay(view.previous.checkedAt)}`
            : ", no earlier complete run to compare with"}
          .
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">What this means: </span>
        {COVERAGE_MEANING}
        {view.partial
          ? " This run did not check every keyword, so the bands below can undercount."
          : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <caption className="sr-only">
            Keywords by position band, {device}
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Position band</th>
              <th className="whitespace-nowrap py-1.5 pr-3 text-right font-medium">Keywords</th>
              <th className="py-1.5 font-medium">Change vs previous run</th>
            </tr>
          </thead>
          <tbody>
            {view.bands.map((band) => (
              <tr
                key={band.key}
                className="border-b border-border/60 align-top"
              >
                <td className="py-2 pr-3">
                  <div className="font-medium">{band.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {band.meaning}
                  </div>
                </td>
                <td className="py-2 pr-3 text-right text-lg font-semibold tabular-nums">
                  {band.count}
                </td>
                <td className="py-2 text-muted-foreground">
                  {changeText(band.count, band.before)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoverList
          title="Biggest gains"
          movers={view.gains}
          empty="No keyword moved up."
        />
        <MoverList
          title="Biggest losses"
          movers={view.losses}
          empty="No keyword moved down."
        />
      </div>
      <NameList title="Started ranking" names={view.entered} />
      <NameList title="Stopped ranking" names={view.dropped} />
    </div>
  );
}

export function OverviewRankings({
  projectId,
  rankings,
  device,
  onTrackerChange,
  onDeviceChange,
}: {
  projectId: string;
  rankings: Rankings;
  device: OverviewDevice;
  onTrackerChange: (tracker: string) => void;
  onDeviceChange: (device: OverviewDevice) => void;
}) {
  const { config, configs, view } = rankings;
  const trackerItems = configs.map((candidate) => ({
    value: candidate.id,
    label: `${candidate.locationName ?? "National"} (${candidate.domain}, ${candidate.keywordCount} keywords)`,
  }));

  let content;
  if (rankings.loading) {
    content = <Skeleton className="h-64" aria-busy />;
  } else if (rankings.error) {
    content = (
      <QueryError
        error={rankings.error}
        fallback="Failed to load rank tracker data"
        onRetry={rankings.refetch}
        isRetrying={false}
      />
    );
  } else if (!config) {
    content = (
      <EmptyState
        variant="plain"
        title="No rank tracker yet"
        description="Set up a rank tracker to see where the site ranks for the phrases that matter."
        action={
          <Button
            variant="outline"
            render={
              <Link to="/p/$projectId/rank-tracking" params={{ projectId }} />
            }
          >
            Open Rank Tracking
          </Button>
        }
      />
    );
  } else if (!view) {
    content = (
      <EmptyState
        variant="plain"
        title="No completed full check yet"
        description={`The ${device} tracker for ${config.domain} has no completed run to show. Partial or subset runs are not shown here.`}
      />
    );
  } else {
    content = <Body view={view} device={device} />;
  }

  return (
    <CardShell
      title="Keyword rankings"
      action={
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[device]}
          className="print:hidden"
          aria-label="Device"
          onValueChange={(next) => {
            const match = OVERVIEW_DEVICES.find((item) => item === next[0]);
            if (match) onDeviceChange(match);
          }}
        >
          {OVERVIEW_DEVICES.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {item === "desktop" ? "Desktop" : "Mobile"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Source: our rank tracker. These are organic positions only, not map
          pack or AI answer spots, so they will not match tools that count
          those.
          {config
            ? ` Showing ${config.locationName ?? "the national tracker"} for ${config.domain}, ${device}.`
            : ""}
        </p>
        {configs.length > 1 ? (
          <div className="max-w-md print:hidden">
            <Select
              items={trackerItems}
              value={config?.id ?? ""}
              onValueChange={(next) => {
                if (next) onTrackerChange(next);
              }}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Tracker">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trackerItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {content}
      </div>
    </CardShell>
  );
}
