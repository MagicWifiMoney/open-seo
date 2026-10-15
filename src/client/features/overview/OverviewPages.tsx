import { CardShell } from "@/client/components/CardShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import { formatNumber } from "@/client/features/traffic/trafficFormat";
import {
  OVERVIEW_PAGE_TABS,
  type OverviewPageTab,
} from "@/types/schemas/overview";
import { pagePath, type PageTableRow } from "./overviewPageRows";

const TAB_LABELS: Record<OverviewPageTab, string> = {
  top: "Top pages",
  new: "New since launch",
};

function clicksChange(row: PageTableRow): string {
  if (row.clicksBefore === null) return "n/a";
  const diff = row.clicks - row.clicksBefore;
  const rounded = Math.round(diff);
  if (rounded === 0) return "No change";
  return `${rounded > 0 ? "+" : ""}${formatNumber(rounded)}`;
}

function positionChange(row: PageTableRow): string {
  if (row.positionBefore === null) return "n/a";
  const diff = row.positionBefore - row.position;
  if (Math.abs(diff) < 0.1) return "No change";
  return diff > 0
    ? `${diff.toFixed(1)} closer to top`
    : `${Math.abs(diff).toFixed(1)} further`;
}

export function OverviewPages({
  tab,
  onTabChange,
  topRows,
  newRows,
  windowLabel,
  compareLabel,
  lookbackLabel,
  lookbackNote,
  truncatedNote,
}: {
  tab: OverviewPageTab;
  onTabChange: (tab: OverviewPageTab) => void;
  topRows: PageTableRow[];
  /** Null when the before-launch history could not be read. */
  newRows: PageTableRow[] | null;
  windowLabel: string;
  compareLabel: string;
  lookbackLabel: string | null;
  lookbackNote: string | null;
  truncatedNote: string | null;
}) {
  const rows = tab === "top" ? topRows : (newRows ?? []);
  return (
    <CardShell
      title="Top performing pages"
      action={
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[tab]}
          className="print:hidden"
          aria-label="Page list"
          onValueChange={(next) => {
            const match = OVERVIEW_PAGE_TABS.find((item) => item === next[0]);
            if (match) onTabChange(match);
          }}
        >
          {OVERVIEW_PAGE_TABS.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {TAB_LABELS[item]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Source: Google Search Console, pages ranked by clicks for{" "}
          {windowLabel}. Change columns compare with {compareLabel}.
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">What this means: </span>
          Clicks are visits from Google to that page. Average position is where
          the page usually shows in results (1 is the top, lower is better).
          {tab === "new"
            ? ` New since launch lists pages that showed in Google during the window but had no impressions in ${lookbackLabel ?? "the period before launch"}.`
            : ""}
        </p>
        {tab === "new" && newRows === null ? (
          <EmptyState
            variant="plain"
            kind="error"
            title="Before-launch history unavailable"
            description="Search Console history for the period before launch could not be read, so new pages cannot be told apart."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            variant="plain"
            title={
              tab === "new"
                ? "No new pages in this window"
                : "No pages with impressions in this window"
            }
          />
        ) : (
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[12rem]">Page</TableHead>
                <TableHead className="text-right whitespace-nowrap">Clicks</TableHead>
                <TableHead className="text-right whitespace-nowrap">Shown</TableHead>
                <TableHead className="text-right whitespace-nowrap">Avg position</TableHead>
                <TableHead className="text-right whitespace-nowrap">Clicks change</TableHead>
                <TableHead className="text-right whitespace-nowrap">Position change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="min-w-[12rem] max-w-[16rem] break-all">
                    {pagePath(row.key)}
                    {tab === "new" ? (
                      <Badge variant="info" className="ml-2">
                        New
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatNumber(row.clicks)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatNumber(row.impressions)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {row.position.toFixed(1)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {clicksChange(row)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {positionChange(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {lookbackNote && tab === "new" ? (
          <p className="text-xs text-muted-foreground">{lookbackNote}</p>
        ) : null}
        {truncatedNote ? (
          <p className="text-xs text-muted-foreground">{truncatedNote}</p>
        ) : null}
      </div>
    </CardShell>
  );
}
