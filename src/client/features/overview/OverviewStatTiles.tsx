import { CardShell } from "@/client/components/CardShell";
import type { StatTile, Tone } from "./overviewWidgets";

const VALUE_TONE: Record<Tone, string> = {
  good: "text-success",
  bad: "text-destructive",
  neutral: "text-foreground",
};

function Tile({ tile }: { tile: StatTile }) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-3 print:break-inside-avoid">
      <p
        className={`text-3xl font-semibold tabular-nums ${VALUE_TONE[tile.tone]}`}
      >
        {tile.value}
      </p>
      <p className="text-sm font-semibold">{tile.label}</p>
      <p className="mt-1 break-words text-xs text-muted-foreground">
        {tile.context}
      </p>
    </div>
  );
}

/** What moved, as big numbers. The old sentences stay one click away for the
 *  plain-text read. */
export function OverviewStatTiles({
  tiles,
  sentences,
}: {
  tiles: StatTile[];
  sentences: string[];
}) {
  return (
    <section aria-label="What changed">
      <CardShell title="What changed">
        <div className="space-y-3">
          {tiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {tiles.map((tile) => (
                <Tile key={tile.key} tile={tile} />
              ))}
            </div>
          ) : null}
          {sentences.length > 0 ? (
            <details className="text-sm">
              <summary className="w-fit cursor-pointer select-none text-muted-foreground">
                Read as sentences
              </summary>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {sentences.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Written from the numbers on this page. It says what moved, not
                why.
              </p>
            </details>
          ) : null}
        </div>
      </CardShell>
    </section>
  );
}
