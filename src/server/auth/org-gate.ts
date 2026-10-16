import {
  canSpend,
  hasOrgPermission,
  type OrgPermissionRequest,
} from "@/lib/org-permissions";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import {
  SPEND_NOT_ALLOWED_MESSAGE,
  SPEND_NOT_ALLOWED_REASON,
} from "@/server/auth/spendFunctions";
import { AppError } from "@/server/lib/errors";

// Server-side org-role gate for app resources (billing/project/integration).
// Zero-I/O: the role was already resolved from the member row by ensure-user.
export function requireOrgPermission(
  context: Pick<EnsuredUserContext, "role">,
  permissions: OrgPermissionRequest,
) {
  if (!hasOrgPermission(context.role, permissions)) {
    throw new AppError(
      "FORBIDDEN",
      "Your organization role does not allow this action.",
    );
  }
}

// Paid-work gate: DataForSEO, site audits, AI visibility runs, OpenRouter
// research. Call at the top of every spending handler, before any I/O.
export function requireSpend(context: Pick<EnsuredUserContext, "role">) {
  if (!canSpend(context.role)) {
    throw new AppError("FORBIDDEN", SPEND_NOT_ALLOWED_MESSAGE, {
      reason: SPEND_NOT_ALLOWED_REASON,
    });
  }
}
