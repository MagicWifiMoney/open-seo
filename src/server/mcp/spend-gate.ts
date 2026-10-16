import { canSpend } from "@/lib/org-permissions";
import {
  SPEND_NOT_ALLOWED_MESSAGE,
  SPEND_NOT_ALLOWED_REASON,
} from "@/server/auth/spendFunctions";
import { AppError } from "@/server/lib/errors";
import type { ToolContext } from "@/server/mcp/context";

// Wraps a tool handler so roles without research:spend are refused before any
// paid work. Shared by the MCP server and SAM's tool adapter.
export function withSpendGate<TArgs, TResult>(
  spend: boolean | undefined,
  handler: (args: TArgs, context: ToolContext) => TResult,
) {
  return (args: TArgs, context: ToolContext): TResult => {
    if (spend && !canSpend(context.auth.role)) {
      throw new AppError("FORBIDDEN", SPEND_NOT_ALLOWED_MESSAGE, {
        reason: SPEND_NOT_ALLOWED_REASON,
      });
    }
    return handler(args, context);
  };
}
