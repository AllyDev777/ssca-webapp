/**
 * Creates an admin account (or promotes an existing user and resets their password).
 * Usage: npm run create-admin   (= npx tsx scripts/create-admin.ts)
 * Reads DB_* settings from .env.local. The password is typed interactively and never stored in plain text.
 */
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { hashPassword, passwordProblem } from "../lib/password";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Readline echoes keystrokes through `output`; muting it hides the password.
let muted = false;
const output = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });

async function ask(prompt: string): Promise<string> {
  return (await rl.question(prompt)).trim();
}

async function askHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  muted = true;
  try {
    return await rl.question("");
  } finally {
    muted = false;
    process.stdout.write("\n");
  }
}

const nameSchema = z.string().trim().min(1, "Name is required.").max(100);
const emailSchema = z.email("Enter a valid email address.").max(190);

async function main(): Promise<void> {
  for (const key of ["DB_HOST", "DB_USER", "DB_NAME"]) {
    if (!process.env[key]) throw new Error(`Missing ${key} — create .env.local from .env.example first.`);
  }

  const email = emailSchema.parse((await ask("Admin email: ")).toLowerCase());
  const name = nameSchema.parse(await ask("Display name: "));

  let password = "";
  for (;;) {
    password = await askHidden("Password: ");
    const problem = passwordProblem(password);
    if (problem) {
      console.log(problem);
      continue;
    }
    if ((await askHidden("Confirm password: ")) !== password) {
      console.log("Passwords do not match.");
      continue;
    }
    break;
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
    charset: "utf8mb4_unicode_ci",
  });

  try {
    await conn.query("SET time_zone = '+00:00'");
    const passwordHash = await hashPassword(password);

    const [existing] = await conn.execute<RowDataPacket[]>("SELECT id FROM users WHERE email = ?", [email]);
    const existingId = existing[0]?.id as number | undefined;

    if (existingId !== undefined) {
      const answer = await ask(`A user with ${email} exists. Promote to admin and reset password? (y/N) `);
      if (answer.toLowerCase() !== "y") {
        console.log("Aborted. Nothing changed.");
        return;
      }
    }

    await conn.beginTransaction();
    let userId: number;
    if (existingId !== undefined) {
      await conn.execute(
        `UPDATE users SET name = ?, password_hash = ?, role = 'admin', is_active = 1,
           failed_logins = 0, locked_until = NULL WHERE id = ?`,
        [name, passwordHash, existingId],
      );
      // Credentials and role changed: invalidate any existing sessions.
      await conn.execute("DELETE FROM sessions WHERE user_id = ?", [existingId]);
      userId = existingId;
    } else {
      const [result] = await conn.execute<ResultSetHeader>(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
        [name, email, passwordHash],
      );
      userId = result.insertId;
    }
    await conn.execute(
      "INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (NULL, ?, 'user', ?, ?)",
      [existingId !== undefined ? "user.promote_admin_cli" : "user.create_admin_cli", userId, JSON.stringify({ email })],
    );
    await conn.commit();
    console.log(`Admin ready: ${email} (id ${userId}).`);
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    await conn.end();
  }
}

main()
  .catch((err: unknown) => {
    if (err instanceof z.ZodError) console.error(err.issues.map((i) => i.message).join("\n"));
    else console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
