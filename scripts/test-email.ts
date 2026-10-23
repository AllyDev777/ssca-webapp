/**
 * Checks the SMTP settings and sends a sample password-reset email.
 * Usage: npm run test-email -- you@example.com
 * Reads .env.local (and .env.production if present). The link in the email is a dummy.
 */
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env.production"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const to = process.argv[2];

async function main(): Promise<void> {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.log("Usage: npm run test-email -- you@example.com");
    process.exitCode = 1;
    return;
  }
  // Imported after the env files are loaded.
  const { appOrigin, closeMail, isMailConfigured, verifyMailConnection } = await import("../lib/mail");
  const { sendResetEmail } = await import("../lib/password-reset");

  if (!isMailConfigured()) {
    console.log("✗ SMTP_HOST is not set. Add the SMTP_* and MAIL_FROM lines to .env.local first.");
    process.exitCode = 1;
    return;
  }
  console.log(`SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 465} as ${process.env.SMTP_USER ?? "(no login)"}`);
  console.log(`Links will point to: ${appOrigin() ?? "(APP_URL missing!)"}`);

  try {
    await verifyMailConnection();
    console.log("✓ Connected and logged in");
    await sendResetEmail(to, "Test Member", "TEST".padEnd(43, "x"));
    console.log(`✓ Sample reset email sent to ${to}. Check the inbox (and spam).`);
  } catch (err) {
    console.log(`✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    closeMail();
  }
}

void main();
