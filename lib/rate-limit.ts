import "server-only";
import { createHash } from "node:crypto";
import { execute, queryOne } from "./db";

type Limit = { name: string; max: number; windowSec: number };

export const LIMITS = {
  login: { name: "login", max: 5, windowSec: 15 * 60 }, // per IP + email
  register: { name: "register", max: 5, windowSec: 60 * 60 }, // per IP
  mutation: { name: "mutation", max: 60, windowSec: 60 }, // per user
  password: { name: "password", max: 5, windowSec: 15 * 60 }, // change-password attempts per user
} as const satisfies Record<string, Limit>;

export type LimitResult = { ok: boolean; retryAfterSec: number };

// Keys are hashed so buckets fit VARCHAR(120) and never store raw emails.
function bucketFor(limit: Limit, key: string): string {
  return `${limit.name}:${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;
}

/** Counts one hit in a fixed window. Atomic: the upsert increments under the row lock. */
export async function hitLimit(limit: Limit, key: string): Promise<LimitResult> {
  const bucket = bucketFor(limit, key);
  // `hits` is assigned before `reset_at`, so both IFs see the old reset_at.
  await execute(
    `INSERT INTO rate_limits (bucket, hits, reset_at)
     VALUES (?, 1, UTC_TIMESTAMP() + INTERVAL ? SECOND)
     ON DUPLICATE KEY UPDATE
       hits = IF(reset_at <= UTC_TIMESTAMP(), 1, hits + 1),
       reset_at = IF(reset_at <= UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL ? SECOND, reset_at)`,
    [bucket, limit.windowSec, limit.windowSec],
  );
  const row = await queryOne<{ hits: number; retry: number }>(
    `SELECT hits, GREATEST(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), reset_at), 0) AS retry
       FROM rate_limits WHERE bucket = ?`,
    [bucket],
  );
  const hits = Number(row?.hits ?? 1);
  return { ok: hits <= limit.max, retryAfterSec: Number(row?.retry ?? limit.windowSec) };
}

export async function clearLimit(limit: Limit, key: string): Promise<void> {
  await execute("DELETE FROM rate_limits WHERE bucket = ?", [bucketFor(limit, key)]);
}

/** For server actions that mutate data: 60 per minute per user. */
export function hitMutationLimit(userId: number): Promise<LimitResult> {
  return hitLimit(LIMITS.mutation, String(userId));
}

export function retryMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
