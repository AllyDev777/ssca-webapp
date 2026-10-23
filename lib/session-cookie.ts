// Session cookie names/options and the signed role hint.
// Edge-safe (Web Crypto only, no "server-only") because middleware.ts imports it.
//
// The role hint lets middleware gate /admin without a DB call. It is only a UX gate:
// real authorization always re-reads the role from the DB via requireAdmin().

export type Role = "member" | "admin";

const secure = process.env.NODE_ENV === "production";

// The __Host- prefix requires Secure, so plain names are used on http://localhost in dev.
export const SESSION_COOKIE = secure ? "__Host-session" : "ssca-session";
export const ROLE_COOKIE = secure ? "__Host-role" : "ssca-role";

export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds
/** Sliding renewal: extend the session at most once per this many seconds. */
export const RENEW_AFTER = 24 * 60 * 60;

export const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
} as const;

/** Tokens are 32 random bytes, base64url-encoded (43 chars). */
export function isTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | undefined;

function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return Promise.reject(new Error("SESSION_SECRET must be set to at least 32 characters."));
  }
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return keyPromise;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Hint format: `role.issuedAt.signature`, signed together with the session token it belongs to. */
export async function signRoleHint(role: Role, token: string): Promise<string> {
  const payload = `${role}.${Math.floor(Date.now() / 1000)}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(`${payload}.${token}`));
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyRoleHint(
  hint: string | undefined,
  token: string,
): Promise<{ role: Role; issuedAt: number } | null> {
  if (!hint) return null;
  const [role, issued, sig] = hint.split(".");
  if ((role !== "member" && role !== "admin") || !issued || !sig || !/^\d{1,12}$/.test(issued)) return null;

  const issuedAt = Number(issued);
  const age = Date.now() / 1000 - issuedAt;
  if (age < -60 || age > SESSION_MAX_AGE) return null;

  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(sig),
      encoder.encode(`${role}.${issued}.${token}`),
    );
    return ok ? { role, issuedAt } : null;
  } catch {
    // Bad base64 or missing secret: treat as no hint.
    return null;
  }
}
