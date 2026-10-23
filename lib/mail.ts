import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email via Nodemailer (SMTP). Configured only through env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, APP_URL
 * Port 465 = TLS from the start (SMTP_SECURE=true); 587 = STARTTLS (SMTP_SECURE=false,
 * TLS is still required). Run `npm run test-email -- you@example.com` to check the settings.
 */

export type MailMessage = { to: string; subject: string; text: string; html: string };

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

function readConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim().toLowerCase() === "true" : port === 465;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const from = process.env.MAIL_FROM?.trim() || user;
  if (!from) {
    console.error("[mail] Set MAIL_FROM (or SMTP_USER) to the sender address.");
    return null;
  }
  return { host, port, secure, user, password: process.env.SMTP_PASSWORD ?? "", from };
}

export function isMailConfigured(): boolean {
  return readConfig() !== null;
}

/** Public origin of the app for links in emails. From config, never from the request Host header. */
export function appOrigin(): string | null {
  const raw = process.env.APP_URL?.trim() || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  try {
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}

// One pooled transporter per process, rebuilt if the settings change (dev reloads).
const cache = globalThis as typeof globalThis & { __sscaMail?: { key: string; transporter: Transporter } };

function transporter(cfg: MailConfig): Transporter {
  const key = JSON.stringify(cfg);
  if (cache.__sscaMail?.key !== key) {
    cache.__sscaMail?.transporter.close();
    cache.__sscaMail = {
      key,
      transporter: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        requireTLS: !cfg.secure, // never fall back to sending the password unencrypted
        auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
        pool: true,
        maxConnections: 2,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
      }),
    };
  }
  return cache.__sscaMail.transporter;
}

/** Sends one email. Throws on any failure; callers log it. */
export async function sendMail(msg: MailMessage): Promise<void> {
  const cfg = readConfig();
  if (!cfg) throw new Error("Email is not configured (set SMTP_HOST and related variables).");
  await transporter(cfg).sendMail({
    from: cfg.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    headers: { "Auto-Submitted": "auto-generated" },
  });
}

/** Connects and logs in without sending anything. Used by `npm run test-email`. */
export async function verifyMailConnection(): Promise<void> {
  const cfg = readConfig();
  if (!cfg) throw new Error("Email is not configured (set SMTP_HOST and related variables).");
  await transporter(cfg).verify();
}

/** Closes pooled SMTP connections (lets CLI scripts exit). */
export function closeMail(): void {
  cache.__sscaMail?.transporter.close();
  cache.__sscaMail = undefined;
}

/** Escapes text for use inside the HTML email body. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
