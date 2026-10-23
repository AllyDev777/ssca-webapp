"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { createSession, requireUser, revokeOtherSessions } from "@/lib/auth";
import { execute, queryOne, transaction } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { LIMITS, clearLimit, hitLimit, hitMutationLimit, retryMessage } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { changePasswordSchema, fieldErrors, formFields, nameSchema } from "@/lib/validation";

/** Self-service account actions. Always the signed-in user's own account. */

export type AccountFormState = {
  savedAt?: number;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const TOO_FAST = "You're going a little fast — please wait a moment.";
const UNEXPECTED = "Something went wrong. Please try again.";

export async function updateName(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(formFields(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  try {
    if (!(await hitMutationLimit(user.id)).ok) return { error: TOO_FAST };
    await execute("UPDATE users SET name = ? WHERE id = ?", [parsed.data.name, user.id]);
  } catch (err) {
    console.error("[account] updateName failed:", err);
    return { error: UNEXPECTED };
  }
  revalidatePath("/", "layout"); // name appears in the sidebar and greetings
  return { savedAt: Date.now(), message: "Name updated." };
}

/**
 * Requires the current password. On success every session is revoked (other devices are
 * signed out) and this device gets a fresh session token.
 */
export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(formFields(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { current, password } = parsed.data;
  const limitKey = String(user.id);

  try {
    // Separate, stricter limit: stops a stolen session from brute-forcing the current password.
    const limit = await hitLimit(LIMITS.password, limitKey);
    if (!limit.ok) return { error: retryMessage(limit.retryAfterSec) };

    const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [user.id]);
    if (!row || !(await verifyPassword(row.password_hash, current))) {
      return { fieldErrors: { current: "That isn't your current password." } };
    }

    const passwordHash = await hashPassword(password);
    const meta = await getRequestMeta();
    await transaction(async (conn) => {
      await execute(
        "UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?",
        [passwordHash, user.id],
        conn,
      );
      await execute("DELETE FROM sessions WHERE user_id = ?", [user.id], conn);
      await audit(conn, { actorId: user.id, action: "account.password_change", entity: "user", entityId: user.id, ip: meta.ip });
    });
    await createSession(user.id, user.role, meta);
    await clearLimit(LIMITS.password, limitKey);
  } catch (err) {
    console.error("[account] changePassword failed:", err);
    return { error: UNEXPECTED };
  }
  revalidatePath("/account");
  return { savedAt: Date.now(), message: "Password changed. Your other devices have been signed out." };
}

export type DevicesResult = { ok: true; message: string } | { ok: false; error: string };

export async function signOutOtherDevices(): Promise<DevicesResult> {
  const user = await requireUser();
  try {
    if (!(await hitMutationLimit(user.id)).ok) return { ok: false, error: TOO_FAST };
    const n = await revokeOtherSessions(user.id);
    revalidatePath("/account");
    return { ok: true, message: n === 0 ? "No other devices were signed in." : `Signed out ${n} other device${n === 1 ? "" : "s"}.` };
  } catch (err) {
    console.error("[account] signOutOtherDevices failed:", err);
    return { ok: false, error: UNEXPECTED };
  }
}
