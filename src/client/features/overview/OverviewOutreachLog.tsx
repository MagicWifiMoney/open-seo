import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  addOutreachEntry,
  deleteOutreachEntry,
  listOutreachLog,
  updateOutreachEntry,
} from "@/serverFunctions/offsite";
import {
  OUTREACH_CHANNELS,
  OUTREACH_STATUSES,
  type OutreachChannel,
  type OutreachStatus,
} from "@/types/schemas/offsite";
import {
  channelLabel,
  formatSnapshotDate,
  statusLabel,
} from "./overviewOffsite";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-background px-2 text-base text-foreground md:text-sm";

export function OverviewOutreachLog({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["offsiteOutreach", projectId];
  const log = useQuery({
    queryKey,
    queryFn: () => listOutreachLog({ data: { projectId } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const add = useMutation({
    mutationFn: addOutreachEntry,
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: updateOutreachEntry,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: deleteOutreachEntry,
    onSuccess: refresh,
  });

  const [targetName, setTargetName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("directory");
  const [status, setStatus] = useState<OutreachStatus>("planned");
  const [askedOn, setAskedOn] = useState("");
  const [note, setNote] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (targetName.trim() === "") return;
    add.mutate(
      {
        data: {
          projectId,
          targetName,
          targetUrl,
          channel,
          status,
          askedOn: askedOn === "" ? null : askedOn,
          linkedPageUrl: null,
          note,
        },
      },
      {
        onSuccess: () => {
          setTargetName("");
          setTargetUrl("");
          setAskedOn("");
          setNote("");
        },
      },
    );
  };

  const entries = log.data ?? [];

  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">Outreach log</h3>
      {log.isError && !log.data ? (
        <QueryError
          error={log.error}
          fallback="Could not load the outreach log"
          onRetry={() => void log.refetch()}
          isRetrying={log.isFetching}
        />
      ) : log.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing logged yet. Add each site you ask for a link below.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Target</th>
                <th className="py-1 pr-3 font-medium">Type</th>
                <th className="py-1 pr-3 font-medium">Status</th>
                <th className="py-1 pr-3 font-medium">Asked on</th>
                <th className="py-1 pr-3 font-medium">Linked page</th>
                <th className="py-1 font-medium print:hidden" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{entry.targetName}</div>
                    {entry.targetUrl ? (
                      <div className="break-all text-xs text-muted-foreground">
                        {entry.targetUrl}
                      </div>
                    ) : null}
                    {entry.note ? (
                      <div className="text-xs text-muted-foreground">
                        {entry.note}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">{channelLabel(entry.channel)}</td>
                  <td className="py-2 pr-3">
                    <span className="hidden print:inline">
                      {statusLabel(entry.status)}
                    </span>
                    <select
                      aria-label={`Status for ${entry.targetName}`}
                      className={`${SELECT_CLASS} min-w-32 print:hidden`}
                      value={entry.status}
                      disabled={update.isPending}
                      onChange={(e) => {
                        const next = OUTREACH_STATUSES.find(
                          (s) => s === e.target.value,
                        );
                        if (next)
                          update.mutate({
                            data: { projectId, id: entry.id, status: next },
                          });
                      }}
                    >
                      {OUTREACH_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {entry.askedOn ? formatSnapshotDate(entry.askedOn) : "-"}
                  </td>
                  <td className="py-2 pr-3 break-all">
                    {entry.linkedPageUrl ?? "-"}
                  </td>
                  <td className="py-2 print:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate({ data: { projectId, id: entry.id } })
                      }
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {update.isError || remove.isError ? (
        <p className="text-sm text-destructive">
          That change did not save. Try again.
        </p>
      ) : null}

      <form
        onSubmit={submit}
        className="grid gap-2 sm:grid-cols-2 print:hidden"
        aria-label="Add an outreach entry"
      >
        <Input
          aria-label="Firm or site name"
          placeholder="Firm or site name"
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          required
        />
        <Input
          aria-label="Website (optional)"
          placeholder="Website (optional)"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
        />
        <select
          aria-label="Type"
          className={SELECT_CLASS}
          value={channel}
          onChange={(e) => {
            const next = OUTREACH_CHANNELS.find((c) => c === e.target.value);
            if (next) setChannel(next);
          }}
        >
          {OUTREACH_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {channelLabel(c)}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={SELECT_CLASS}
          value={status}
          onChange={(e) => {
            const next = OUTREACH_STATUSES.find((s) => s === e.target.value);
            if (next) setStatus(next);
          }}
        >
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <Input
          aria-label="Asked on"
          type="date"
          value={askedOn}
          onChange={(e) => setAskedOn(e.target.value)}
        />
        <Input
          aria-label="Note (optional)"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={add.isPending || targetName.trim() === ""}
          >
            {add.isPending ? "Adding..." : "Add to log"}
          </Button>
          {add.isError ? (
            <span className="ml-2 text-sm text-destructive">
              Could not add that entry. Check the fields and try again.
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
