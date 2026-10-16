import { MCP_SCOPE } from "@/lib/oauth-resource";
import { resolveAccessRole } from "@/server/auth/accessRole";
import type { ToolAuthContext } from "@/server/mcp/context";

// Delegated/self-host orgs have no member rows, so a missing row means the
// implicit owner there, unless ACCESS_OWNER_EMAILS is set, in which case unlisted users resolve to
// the read-only `client` role. SAM
// sessions belong to one project's workspace; org context is fixed for the
// session, like an OAuth token's.
export function buildSamAuthContext(
  ctx: {
    row: { userId: string };
    project: { organizationId: string };
    userEmail: string;
  },
  memberRole: string | undefined,
  baseUrl: string,
  env: Parameters<typeof resolveAccessRole>[1],
): ToolAuthContext {
  return {
    userId: ctx.row.userId,
    userEmail: ctx.userEmail,
    organizationId: ctx.project.organizationId,
    role: memberRole ?? resolveAccessRole(ctx.userEmail, env),
    orgScope: "pinned",
    baseUrl,
    clientId: null,
    scopes: [MCP_SCOPE],
  };
}
