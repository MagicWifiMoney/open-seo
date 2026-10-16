// Role for a user admitted by Cloudflare Access. The Access policy decides who
// gets in; ACCESS_OWNER_EMAILS decides who among them is an owner.
//
// - Unset or empty: everyone admitted is an owner (existing self-hosts keep
//   working; the deploy refuses a domain-wide policy without an owner list).
// - Set: only listed emails are owners, everyone else, including a missing
//   email, is a read-only `client`. Fails closed.

type AccessRoleEnv = {
  ACCESS_OWNER_EMAILS?: string;
};

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveAccessRole(
  email: string | null | undefined,
  env: AccessRoleEnv,
): "client" | "owner" {
  const owners = parseList(env.ACCESS_OWNER_EMAILS);
  if (owners.length === 0) return "owner";
  const normalized = (email ?? "").trim().toLowerCase();
  return normalized && owners.includes(normalized) ? "owner" : "client";
}
