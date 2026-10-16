// Role for a user admitted by Cloudflare Access. The Access policy is the
// authorization boundary, so everyone it admits is an owner unless their email
// or email domain is listed as a client seat (read-only, no paid work).

type AccessRoleEnv = {
  ACCESS_CLIENT_DOMAINS?: string;
  ACCESS_CLIENT_EMAILS?: string;
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
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return "owner";

  if (parseList(env.ACCESS_CLIENT_EMAILS).includes(normalized)) return "client";

  const at = normalized.lastIndexOf("@");
  const domain = at >= 0 ? normalized.slice(at + 1) : "";
  const domains = parseList(env.ACCESS_CLIENT_DOMAINS).map((d) =>
    d.replace(/^@/, ""),
  );
  if (domain && domains.includes(domain)) return "client";

  return "owner";
}
