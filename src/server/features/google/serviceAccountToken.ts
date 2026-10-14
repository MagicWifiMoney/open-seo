import { z } from "zod";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

/** Grants stored with this account id read through GOOGLE_SERVICE_ACCOUNT_JSON
 *  instead of a user's OAuth refresh token (self-host only). */
export const SERVICE_ACCOUNT_GRANT_ID = "service-account";

const keySchema = z.object({
  client_email: z.string(),
  private_key: z.string(),
  token_uri: z.string().default("https://oauth2.googleapis.com/token"),
});

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

let cached: { token: string; expiresAt: number } | null = null;

function b64url(bytes: Uint8Array | string): string {
  const raw =
    typeof bytes === "string"
      ? bytes
      : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getServiceAccountAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;
  const json = await getOptionalEnvValue("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set.");
  const key = keySchema.parse(JSON.parse(json));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPES,
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = key.private_key
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  );
  const response = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Service account token request failed: ${response.status} ${await response.text()}`,
    );
  }
  const body = z
    .object({ access_token: z.string(), expires_in: z.number().optional() })
    .parse(await response.json());
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}
