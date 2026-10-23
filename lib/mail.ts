import "server-only";
import { randomBytes } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

/**
 * Minimal SMTP sender (no dependency): implicit TLS (port 465) or STARTTLS (587),
 * AUTH PLAIN, one recipient. Credentials are never sent over an unencrypted link.
 *
 * Env: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, APP_URL.
 */

type MailConfig = {
  host: string;
  port: number;
  secure: boolean; // true = TLS from the start (465); false = upgrade with STARTTLS
  user: string;
  password: string;
  from: { name: string | null; address: string };
};

export type MailMessage = { to: string; subject: string; text: string; html: string };

const TIMEOUT_MS = 15_000;
const ADDRESS = /^[^\s<>()[\]\\,;:"@]+@[^\s<>()[\]\\,;:"@]+\.[^\s<>()[\]\\,;:"@]+$/;

function parseFrom(value: string): MailConfig["from"] | null {
  const match = value.trim().match(/^(?:"?([^"<]*?)"?\s*)?<([^<>]+)>$/);
  const name = match?.[1]?.trim() || null;
  const address = (match?.[2] ?? value).trim();
  return ADDRESS.test(address) ? { name, address } : null;
}

function readConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim().toLowerCase() === "true" : port === 465;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const from = parseFrom(process.env.MAIL_FROM?.trim() || user);
  if (!from) {
    console.error("[mail] MAIL_FROM (or SMTP_USER) is not a valid email address.");
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

// --- SMTP conversation --------------------------------------------------------

type Reply = { code: number; lines: string[] };

class SmtpError extends Error {}

class SmtpSession {
  private socket: net.Socket | null = null;
  private buffer = "";
  private waiting: { resolve: (r: Reply) => void; reject: (e: Error) => void } | null = null;
  private failure: Error | null = null;

  private readonly onData = (chunk: Buffer) => {
    this.buffer += chunk.toString("utf8");
    this.flush();
  };
  private readonly onError = (err: Error) => this.fail(err);
  private readonly onClose = () => this.fail(new SmtpError("SMTP connection closed unexpectedly"));

  attach(socket: net.Socket): void {
    this.socket = socket;
    socket.setTimeout(TIMEOUT_MS, () => {
      this.fail(new SmtpError("SMTP server timed out"));
      socket.destroy();
    });
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
  }

  /** Stops listening so the raw socket can be handed to TLS (STARTTLS). */
  detach(): net.Socket {
    const socket = this.socket;
    if (!socket) throw new SmtpError("No SMTP socket");
    socket.setTimeout(0);
    socket.off("data", this.onData);
    socket.off("error", this.onError);
    socket.off("close", this.onClose);
    this.socket = null;
    this.buffer = "";
    return socket;
  }

  private fail(err: Error): void {
    this.failure ??= err;
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.reject(this.failure);
  }

  /** Resolves the pending read once a complete (possibly multi-line) reply has arrived. */
  private flush(): void {
    if (!this.waiting) return;
    const lines = this.buffer.split("\r\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d{3}(?: |$)/.test(lines[i]!)) {
        const reply = { code: Number(lines[i]!.slice(0, 3)), lines: lines.slice(0, i + 1) };
        this.buffer = lines.slice(i + 1).join("\r\n");
        const waiting = this.waiting;
        this.waiting = null;
        waiting.resolve(reply);
        return;
      }
    }
  }

  read(): Promise<Reply> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject };
      this.flush();
    });
  }

  /** Sends one command and checks the reply code. `label` replaces the command in errors (hides secrets). */
  async send(command: string, expect: number[], label = command): Promise<Reply> {
    if (!this.socket) throw new SmtpError("No SMTP socket");
    this.socket.write(`${command}\r\n`);
    const reply = await this.read();
    if (!expect.includes(reply.code)) {
      throw new SmtpError(`SMTP ${label} failed: ${reply.lines.join(" | ").slice(0, 300)}`);
    }
    return reply;
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.destroy();
  }
}

function connect(cfg: MailConfig): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new SmtpError("SMTP connection timed out")));
    // Connection-refused errors can arrive as an AggregateError with an empty message.
    const onError = (err: NodeJS.ErrnoException) =>
      reject(new SmtpError(`Can't connect to SMTP ${cfg.host}:${cfg.port}: ${err.message || err.code || "unknown error"}`));
    socket.once("error", onError);
    socket.once(cfg.secure ? "secureConnect" : "connect", () => {
      socket.off("error", onError);
      socket.setTimeout(0);
      resolve(socket);
    });
  });
}

function startTls(raw: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ socket: raw, servername: host });
    socket.once("error", reject);
    socket.once("secureConnect", () => {
      socket.off("error", reject);
      resolve(socket);
    });
  });
}

// --- Message building -----------------------------------------------------------

function encodeWord(text: string): string {
  // RFC 2047, so names/subjects with non-ASCII characters survive.
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function base64Body(text: string): string {
  return (Buffer.from(text, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

function buildMessage(cfg: MailConfig, msg: MailMessage): string {
  const boundary = `ssca_${randomBytes(12).toString("hex")}`;
  const domain = cfg.from.address.split("@")[1];
  const from = cfg.from.name ? `${encodeWord(cfg.from.name)} <${cfg.from.address}>` : `<${cfg.from.address}>`;
  const lines = [
    `From: ${from}`,
    `To: <${msg.to}>`,
    `Subject: ${encodeWord(msg.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(16).toString("hex")}@${domain}>`,
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(msg.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Body(msg.html),
    `--${boundary}--`,
  ];
  // Dot-stuffing (RFC 5321 §4.5.2); base64 never starts with ".", but headers could.
  return lines.join("\r\n").replace(/^\./gm, "..");
}

function heloName(): string {
  const origin = appOrigin();
  return origin ? new URL(origin).hostname : "localhost";
}

/** Sends one email. Throws on any failure; callers log it. */
export async function sendMail(msg: MailMessage): Promise<void> {
  const cfg = readConfig();
  if (!cfg) throw new SmtpError("Email is not configured (set SMTP_HOST and related variables).");
  if (!ADDRESS.test(msg.to) || /[\r\n]/.test(msg.subject)) throw new SmtpError("Invalid recipient or subject");

  const smtp = new SmtpSession();
  smtp.attach(await connect(cfg));
  try {
    const greeting = await smtp.read();
    if (greeting.code !== 220) throw new SmtpError(`SMTP greeting failed: ${greeting.lines.join(" | ").slice(0, 300)}`);

    let ehlo = await smtp.send(`EHLO ${heloName()}`, [250]);
    if (!cfg.secure) {
      if (!ehlo.lines.some((l) => /^\d{3}[ -]STARTTLS\b/i.test(l))) {
        throw new SmtpError("SMTP server does not offer STARTTLS; refusing to send credentials unencrypted.");
      }
      await smtp.send("STARTTLS", [220]);
      smtp.attach(await startTls(smtp.detach(), cfg.host));
      ehlo = await smtp.send(`EHLO ${heloName()}`, [250]);
    }

    if (cfg.user) {
      const token = Buffer.from(`\0${cfg.user}\0${cfg.password}`, "utf8").toString("base64");
      await smtp.send(`AUTH PLAIN ${token}`, [235], "AUTH");
    }
    await smtp.send(`MAIL FROM:<${cfg.from.address}>`, [250]);
    await smtp.send(`RCPT TO:<${msg.to}>`, [250, 251], "RCPT TO");
    await smtp.send("DATA", [354]);
    await smtp.send(`${buildMessage(cfg, msg)}\r\n.`, [250], "message");
    await smtp.send("QUIT", [221]).catch(() => undefined);
  } finally {
    smtp.close();
  }
}

/** Escapes text for use inside the HTML email body. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
