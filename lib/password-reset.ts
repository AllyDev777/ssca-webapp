import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { execute, queryOne } from "./db";
import { withBase } from "./base-path";
import { appOrigin, escapeHtml, sendMail } from "./mail";

/**
 * One-time password-reset links. Only the SHA-256 of the token is stored; the token
 * itself exists only in the email. Links expire after RESET_TTL_MINUTES and die on use.
 */

export const RESET_TTL_MINUTES = 60;

export function isResetTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token); // 32 random bytes, base64url
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Replaces any outstanding link for the user with a new one and returns the raw token. */
export async function createResetToken(userId: number, ip: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await execute("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL", [userId]);
  await execute(
    `INSERT INTO password_resets (user_id, token_hash, expires_at, ip)
     VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, ?)`,
    [userId, hashResetToken(token), RESET_TTL_MINUTES, ip],
  );
  return token;
}

/** True if the token is unused, unexpired and belongs to an active account. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!isResetTokenShape(token)) return false;
  const row = await queryOne(
    `SELECT pr.id FROM password_resets pr JOIN users u ON u.id = pr.user_id
      WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > UTC_TIMESTAMP() AND u.is_active = 1`,
    [hashResetToken(token)],
  );
  return row !== null;
}

export async function sendResetEmail(to: string, name: string, token: string): Promise<void> {
  const origin = appOrigin();
  if (!origin) throw new Error("APP_URL is not set, so a reset link can't be built.");
  const link = `${origin}${withBase("/reset-password")}?token=${encodeURIComponent(token)}`;
  const first = name.split(/\s+/)[0] || "there";

  const text = [
    `Hi ${first},`,
    "",
    "We received a request to reset your password for the SSCA Weekly Spiritual Growth app.",
    `Open this link within ${RESET_TTL_MINUTES} minutes to choose a new password:`,
    "",
    link,
    "",
    "If you didn't ask for this, you can ignore this email. Your password won't change.",
    "",
    "Society of Saint Carlo Acutis",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1C1F33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#2E3A87">Society of Saint Carlo Acutis</td></tr>
<tr><td style="padding-top:16px;font-size:22px;font-weight:700">Reset your password</td></tr>
<tr><td style="padding-top:12px;font-size:16px;line-height:1.5">Hi ${escapeHtml(first)}, we received a request to reset your password. This link works once and expires in ${RESET_TTL_MINUTES} minutes.</td></tr>
<tr><td style="padding-top:24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2E3A87;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:12px">Choose a new password</a></td></tr>
<tr><td style="padding-top:24px;font-size:13px;line-height:1.5;color:#5B6176">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></td></tr>
<tr><td style="padding-top:16px;font-size:13px;line-height:1.5;color:#5B6176">Didn't ask for this? Ignore this email and your password won't change.</td></tr>
</table></td></tr></table></body></html>`;

  await sendMail({ to, subject: "Reset your SSCA password", text, html });
}
