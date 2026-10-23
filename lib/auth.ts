import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { execute, queryOne } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { RequestMeta } from "./request";
import {
  RENEW_AFTER,
  ROLE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOptions,
  isTokenShape,
  signRoleHint,
  type Role,
} from "./session-cookie";

export type { Role };
export type SessionUser = { id: number; name: string; email: string; role: Role };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Starts a fresh session (token rotation): any session this browser already had is deleted. */
export async function createSession(userId: number, role: Role, meta: RequestMeta): Promise<void> {
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous) await execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(previous)]);

  const token = randomBytes(32).toString("base64url");
  await execute(
    `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND, ?, ?)`,
    [userId, hashToken(token), SESSION_MAX_AGE, meta.ip, meta.userAgent],
  );
  jar.set(SESSION_COOKIE, token, cookieOptions);
  jar.set(ROLE_COOKIE, await signRoleHint(role, token), cookieOptions);
}

/** Logs out this browser: deletes the DB row and clears both cookies. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  try {
    if (token) await execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  } finally {
    // __Host- cookies are only cleared when Secure/Path match, so reuse the full options.
    jar.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    jar.set(ROLE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  }
}

/** Signs out every session of this user except the one making the request. Returns how many. */
export async function revokeOtherSessions(userId: number): Promise<number> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return 0;
  const result = await execute("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?", [userId, hashToken(token)]);
  return result.affectedRows;
}

export async function countActiveSessions(userId: number): Promise<number> {
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > UTC_TIMESTAMP()",
    [userId],
  );
  return Number(row?.n ?? 0);
}

/** Signs a user out everywhere (role change, deactivation, password reset). */
export async function revokeUserSessions(userId: number): Promise<void> {
  await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

type SessionRow = {
  session_id: number;
  renew: number;
  id: number;
  name: string;
  email: string;
  role: Role;
};

/**
 * The signed-in user, or null. Cached per request, so layouts, pages and actions
 * can all call it without extra queries. Extends the session (sliding expiry) at
 * most once per RENEW_AFTER; middleware refreshes the cookie on the same schedule.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !isTokenShape(token)) return null;

  const row = await queryOne<SessionRow>(
    `SELECT s.id AS session_id,
            s.expires_at < UTC_TIMESTAMP() + INTERVAL ? SECOND AS renew,
            u.id, u.name, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.is_active = 1`,
    [SESSION_MAX_AGE - RENEW_AFTER, hashToken(token)],
  );
  if (!row) return null;

  if (Number(row.renew) === 1) {
    await execute("UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = ?", [
      SESSION_MAX_AGE,
      row.session_id,
    ]);
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
});

/** Call at the top of every member page, server action and route handler. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Call at the top of every admin page, server action and route handler. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Route-handler variant of requireAdmin(): returns a JSON 401/403 instead of redirecting. */
export async function requireAdminApi(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  return user;
}

// Verifying against a real hash when the email is unknown keeps response times
// similar, so timing doesn't reveal which emails have accounts.
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(await dummyHash, password);
}

/** Only same-site relative paths, to prevent open redirects via ?next=. */
export function safeRedirectPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next === "/login" || next === "/register") return "/";
  return next;
}
