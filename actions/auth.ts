"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, safeRedirectPath, verifyAgainstDummy, type Role } from "@/lib/auth";
import { execute, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { LIMITS, clearLimit, hitLimit, retryMessage } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { fieldErrors, formFields, loginSchema, registerSchema } from "@/lib/validation";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: { name?: string; email?: string };
};

const INVALID_LOGIN = "Invalid email or password.";
const UNEXPECTED = "Something went wrong. Please try again.";
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

function echo(formData: FormData, ...keys: ("name" | "email")[]): AuthFormState["values"] {
  const values: AuthFormState["values"] = {};
  for (const key of keys) {
    const v = formData.get(key);
    if (typeof v === "string") values[key] = v.slice(0, 190);
  }
  return values;
}

type UserRow = { id: number; role: Role; password_hash: string; is_active: number; locked: number };

async function attemptLogin(formData: FormData): Promise<AuthFormState | { next: string }> {
  const values = echo(formData, "email");
  const parsed = loginSchema.safeParse(formFields(formData));
  if (!parsed.success) return { error: INVALID_LOGIN, values };
  const { email, password, next } = parsed.data;

  const meta = await getRequestMeta();
  const limitKey = `${meta.ip ?? "unknown"}|${email}`;
  const limit = await hitLimit(LIMITS.login, limitKey);
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSec), values };

  const user = await queryOne<UserRow>(
    `SELECT id, role, password_hash, is_active,
            (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS locked
       FROM users WHERE email = ?`,
    [email],
  );
  if (!user) {
    await verifyAgainstDummy(password);
    return { error: INVALID_LOGIN, values };
  }
  if (Number(user.locked) === 1) return { error: retryMessage(LOCKOUT_MINUTES * 60), values };

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    // Lock after MAX_FAILED_LOGINS; the counter restarts once a lock is applied.
    // locked_until is assigned first so both expressions read the old failed_logins.
    await execute(
      `UPDATE users
          SET locked_until = IF(failed_logins + 1 >= ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, locked_until),
              failed_logins = IF(failed_logins + 1 >= ?, 0, failed_logins + 1)
        WHERE id = ?`,
      [MAX_FAILED_LOGINS, LOCKOUT_MINUTES, MAX_FAILED_LOGINS, user.id],
    );
    return { error: INVALID_LOGIN, values };
  }
  if (Number(user.is_active) !== 1) return { error: INVALID_LOGIN, values };

  await execute("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?", [user.id]);
  await clearLimit(LIMITS.login, limitKey);
  await createSession(user.id, user.role, meta);
  return { next: safeRedirectPath(next) };
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let result: Awaited<ReturnType<typeof attemptLogin>>;
  try {
    result = await attemptLogin(formData);
  } catch (err) {
    console.error("[auth] login failed:", err);
    return { error: UNEXPECTED, values: echo(formData, "email") };
  }
  if ("next" in result) redirect(result.next); // outside try: redirect() works by throwing
  return result;
}

async function attemptRegister(formData: FormData): Promise<AuthFormState | null> {
  const values = echo(formData, "name", "email");
  const parsed = registerSchema.safeParse(formFields(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { name, email, password } = parsed.data;

  const meta = await getRequestMeta();
  const limit = await hitLimit(LIMITS.register, meta.ip ?? "unknown");
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSec), values };

  const taken = { fieldErrors: { email: "An account with this email already exists. Try signing in." }, values };
  if (await queryOne("SELECT id FROM users WHERE email = ?", [email])) return taken;

  let userId: number;
  try {
    const result = await execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", [
      name,
      email,
      await hashPassword(password),
    ]);
    userId = result.insertId;
  } catch (err) {
    // Lost a race with a concurrent registration for the same email.
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") return taken;
    throw err;
  }

  await createSession(userId, "member", meta);
  return null;
}

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let result: AuthFormState | null;
  try {
    result = await attemptRegister(formData);
  } catch (err) {
    console.error("[auth] register failed:", err);
    return { error: UNEXPECTED, values: echo(formData, "name", "email") };
  }
  if (!result) redirect("/");
  return result;
}

export async function logout(): Promise<void> {
  try {
    await destroySession();
  } catch (err) {
    console.error("[auth] logout failed:", err);
  }
  redirect("/login");
}
