import { Link, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Plus } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { QueryError } from "@/client/components/QueryState";
import { StatusScreen } from "@/client/components/StatusScreen";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/client/components/ui/sheet";
import {
  invalidateSamSessions,
  samSessionsQueryOptions,
} from "@/client/features/sam/samQueries";
import { createSamSession } from "@/serverFunctions/sam";
import { SamConversation } from "./SamConversation";
import { optInToSamBeta } from "./samBetaOptIn";
import { useSamAccess } from "./useSamAccess";

/**
 * Floating "chat with your data" button for every project page. Opens the SAM
 * conversation in a right-side sheet. It renders only when SAM is confirmed
 * usable (useSamAccess "ready") and never on the full /sam page; checking,
 * error and setup states render nothing rather than an error in the corner.
 */
export function SamBubble({ projectId }: { projectId: string }) {
  const access = useSamAccess(projectId);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (access.status !== "ready" || pathname.endsWith("/sam")) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // The bubble is an explicit request to chat, so skip the beta prompt.
        if (next) optInToSamBeta();
        setOpen(next);
      }}
    >
      <SheetTrigger
        render={
          <Button
            size="icon-lg"
            aria-label="Chat with your data"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 size-12 rounded-full shadow-lg sm:right-6 sm:bottom-6"
          />
        }
      >
        <MessageCircle className="size-5" />
      </SheetTrigger>
      <SheetContent
        showCloseButton
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
      >
        <SamBubblePanel
          projectId={projectId}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

// Mounted only while the sheet is open (the popup unmounts on close), so the
// session lookup and the agent socket cost nothing until someone clicks.
function SamBubblePanel({
  projectId,
  onNavigate,
}: {
  projectId: string;
  onNavigate: () => void;
}) {
  const sessionsQuery = useQuery(samSessionsQueryOptions(projectId));
  // A chat the user started with "New chat" this visit; otherwise the latest.
  const [pickedId, setPickedId] = useState<string>();
  const createSession = useMutation({
    mutationFn: () => createSamSession({ data: { projectId } }),
    onSuccess: async ({ id }) => {
      await invalidateSamSessions(projectId);
      setPickedId(id);
    },
  });

  const sessions = sessionsQuery.data;
  const sessionId = pickedId ?? sessions?.[0]?.id;
  const needsSession = sessions !== undefined && sessionId === undefined;
  const { mutate: create, isPending, isError } = createSession;
  // Empty project: start the first chat once. A failed create is not retried
  // automatically; the error state below has a button.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!needsSession || autoStarted.current) return;
    autoStarted.current = true;
    create();
  }, [needsSession, create]);

  return (
    <>
      <SheetHeader className="border-b border-border pr-12">
        <SheetTitle>Ask about your data</SheetTitle>
        <SheetDescription className="sr-only">
          Chat with the AI agent about this project.
        </SheetDescription>
        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="outline"
            size="xs"
            pending={isPending}
            onClick={() => create()}
          >
            <Plus />
            New chat
          </Button>
          {sessionId ? (
            <Link
              to="/p/$projectId/sam"
              params={{ projectId }}
              search={{ s: sessionId }}
              onClick={onNavigate}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open full view
            </Link>
          ) : null}
        </div>
      </SheetHeader>
      <div className="flex min-h-0 flex-1">
        {sessionId ? (
          <Suspense fallback={<StatusScreen pending />}>
            <SamConversation
              key={sessionId}
              projectId={projectId}
              sessionId={sessionId}
            />
          </Suspense>
        ) : sessionsQuery.isError ? (
          <StatusScreen>
            <QueryError
              error={sessionsQuery.error}
              fallback="Failed to load your chats."
              onRetry={() => void sessionsQuery.refetch()}
              isRetrying={sessionsQuery.isFetching}
            />
          </StatusScreen>
        ) : isError ? (
          <StatusScreen>
            <QueryError
              error={createSession.error}
              fallback="Failed to start a new chat."
              onRetry={() => create()}
            />
          </StatusScreen>
        ) : (
          <StatusScreen pending />
        )}
      </div>
    </>
  );
}
