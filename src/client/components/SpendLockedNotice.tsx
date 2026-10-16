import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "cn";
import { useCanSpend } from "@/client/features/team/organizationQueries";

export const SPEND_LOCKED_TEXT =
  "Research credits aren't enabled for your account yet. You can still browse all stored data and save keywords.";

/**
 * Calm inline notice for features that spend research credits when the
 * account's role cannot spend. `compact` is the one-line form for a disabled
 * button's tooltip or helper text.
 */
export function SpendLockedNotice({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <Lock className="size-3 shrink-0" aria-hidden="true" />
        <span>Research credits aren't enabled for your account yet.</span>
      </p>
    );
  }
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground",
        className,
      )}
    >
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{SPEND_LOCKED_TEXT}</p>
    </div>
  );
}

/**
 * Page-level guard for routes whose queries all spend credits. Renders the
 * notice instead of `children` for a non-spending role, so the paid queries
 * inside `children` never mount. Cosmetic: the server gate still enforces.
 */
export function SpendGate({ children }: { children: ReactNode }) {
  const canSpend = useCanSpend();
  if (canSpend) return children;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <SpendLockedNotice />
    </div>
  );
}
