"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { execute, queryOne, transaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createResetToken, hashResetToken, sendResetEmail } from "@/lib/password-reset";
import { LIMITS, hitLimit, retryMessage } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { fieldErrors, forgotPasswordSchema, formFields, resetPasswordSchema } from "@/lib/validation";

export type ForgotFormState = { sent?: boolean; error?: string; fieldErrors?: Record<string, string>; email?: string };
export type ResetFormState = { error?: string; fieldErrors?: Record<string, string> };

const UNEXPECTED = "Something went wrong. Please try again.";
const LINK_EXPIRED = "This reset link has expired or was already used. Please request a new one.";

/**
 * Always answers the same way whether or not the email has an account, so the form
 * can't be used to discover members. The email is sent in the background, which also
 * keeps response times identical.
 */
export async function requestPasswordReset(_prev: ForgotFormState, formData: FormData): Promise<ForgotFormState> {
  const raw = formData.get("email");
  const echo = typeof raw === "string" ? raw.slice(0, 190) : "";
  const parsed = forgotPasswordSchema.safeParse(formFields(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), email: echo };
  const { email } = parsed.data;

  try {
    const meta = await getRequestMeta();
    const perIp = await hitLimit(LIMITS.resetRequestIp, meta.ip ?? "unknown");
    if (!perIp.ok) return { error: retryMessage(perIp.retryAfterSec), email: echo };

    // Over the per-address limit: skip silently (still shows "sent"), so mailboxes can't be flooded.
    if ((await hitLimit(LIMITS.resetRequestEmail, email)).ok) {
      const user = await queryOne<{ id: number; name: string }>(
        "SELECT id, name FROM users WHERE email = ? AND is_active = 1",
        [email],
      );
      if (user) {
        const token = await createResetToken(user.id, meta.ip);
        void sendResetEmail(email, user.name, token).catch((err: unknown) => {
          console.error("[auth] password reset email failed:", err instanceof Error ? err.message : err);
        });
      }
    }
  } catch (err) {
    console.error("[auth] requestPasswordReset failed:", err);
    return { error: UNEXPECTED, email: echo };
  }
  return { sent: true, email };
}

/** Sets a new password from a valid link, then signs the account out everywhere. */
export async function resetPassword(_prev: ResetFormState, formData: FormData): Promise<ResetFormState> {
  const parsed = resetPasswordSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return errors.token ? { error: LINK_EXPIRED } : { fieldErrors: errors };
  }
  const { token, password } = parsed.data;

  try {
    const meta = await getRequestMeta();
    const limit = await hitLimit(LIMITS.resetSubmit, meta.ip ?? "unknown");
    if (!limit.ok) return { error: retryMessage(limit.retryAfterSec) };

    const passwordHash = await hashPassword(password); // slow; done before taking row locks
    const done = await transaction(async (conn) => {
      const reset = await queryOne<{ id: number; user_id: number }>(
        `SELECT id, user_id FROM password_resets
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE`,
        [hashResetToken(token)],
        conn,
      );
      if (!reset) return false;
      const user = await queryOne("SELECT id FROM users WHERE id = ? AND is_active = 1 FOR UPDATE", [reset.user_id], conn);
      if (!user) return false;

      await execute(
        "UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?",
        [passwordHash, reset.user_id],
        conn,
      );
      await execute("UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE id = ?", [reset.id], conn);
      await execute("DELETE FROM password_resets WHERE user_id = ? AND id <> ?", [reset.user_id, reset.id], conn);
      await execute("DELETE FROM sessions WHERE user_id = ?", [reset.user_id], conn);
      await audit(conn, { actorId: reset.user_id, action: "account.password_reset", entity: "user", entityId: reset.user_id, ip: meta.ip });
      return true;
    });
    if (!done) return { error: LINK_EXPIRED };
  } catch (err) {
    console.error("[auth] resetPassword failed:", err);
    return { error: UNEXPECTED };
  }
  redirect("/login?reset=1"); // outside try: redirect() works by throwing
}
