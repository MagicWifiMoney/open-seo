import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// App-level resources layered on top of better-auth's built-in org statements
// (organization/member/invitation management, which the plugin's own endpoints
// already enforce). Spreading defaultStatements is required — a custom
// statement object otherwise REPLACES the built-in catalog and every plugin
// permission check fails.
const statement = {
  ...defaultStatements,
  // Subscribe, top-ups, Stripe portal, cancel. Owner-only.
  billing: ["manage"],
  // Create + archive/restore projects. Renames/settings stay open to all.
  project: ["create", "delete"],
  // GSC/GA4 connect, re-point, disconnect.
  integration: ["manage"],
  // Anything that spends paid credits: DataForSEO, site audits, AI visibility
  // runs, OpenRouter research. The `client` role deliberately lacks it.
  research: ["spend"],
} as const;

export const orgAccessControl = createAccessControl(statement);

export const orgRoles = {
  owner: orgAccessControl.newRole({
    ...ownerAc.statements,
    billing: ["manage"],
    project: ["create", "delete"],
    integration: ["manage"],
    research: ["spend"],
  }),
  admin: orgAccessControl.newRole({
    ...adminAc.statements,
    project: ["create", "delete"],
    integration: ["manage"],
    research: ["spend"],
  }),
  // Defined from day one so exposing it later is UI-only; not offered in the
  // invite picker yet. Members can view everything and run research, but not
  // manage the org, billing, projects, or integrations.
  member: orgAccessControl.newRole({
    ...memberAc.statements,
    research: ["spend"],
  }),
  // Read-only client seat: reads every data surface and can save keywords, but
  // never triggers paid work. No billing, project, integration or research.
  client: orgAccessControl.newRole({
    ...memberAc.statements,
  }),
};

export type OrgPermissionRequest = Partial<{
  [K in keyof typeof statement]: Array<(typeof statement)[K][number]>;
}>;

const roleByName = new Map<string, (typeof orgRoles)[keyof typeof orgRoles]>(
  Object.entries(orgRoles),
);

// better-auth stores multiple roles as one comma-separated string and ORs
// permission checks across them; mirror that here. Unknown role names fail
// closed.
export function hasOrgPermission(
  role: string,
  permissions: OrgPermissionRequest,
): boolean {
  return role.split(",").some((name) => {
    const candidate = roleByName.get(name.trim());
    return candidate ? candidate.authorize(permissions).success : false;
  });
}

export function canSpend(role: string): boolean {
  return hasOrgPermission(role, { research: ["spend"] });
}
