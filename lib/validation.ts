import { z } from "zod";
import { ALLOWED_PROVIDERS_TEXT, isAllowedEmailDomain } from "./email-domains";
import { PASSWORD_MAX, passwordProblem } from "./password-rules";
import { isIsoDate, isWeekStart } from "./week";

/**
 * FormData → plain object for zod. React adds its own `$ACTION_…` fields to
 * progressively-enhanced forms; those are dropped so `z.strictObject` can still
 * reject every other unknown key. File values are kept so they fail string checks.
 */
export function formFields(formData: FormData): Record<string, FormDataEntryValue> {
  const fields: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData) {
    if (!key.startsWith("$ACTION")) fields[key] = value;
  }
  return fields;
}

/** First error message per top-level field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const weekStartSchema = z.string().refine(isWeekStart, "Invalid week.");

export const toggleItemSchema = z.strictObject({
  weekStart: weekStartSchema,
  activityId: z.number().int().positive().max(4_294_967_295),
  completed: z.boolean(),
});

export const submitWeekSchema = z.strictObject({ weekStart: weekStartSchema });

// --- Admin ------------------------------------------------------------------

const id = z.coerce.number().int().positive().max(4_294_967_295);

export const activityFormSchema = z.strictObject({
  id: z.union([z.literal(""), id]).optional(), // empty/missing = create
  title: z.string().trim().min(1, "Please enter a title.").max(150, "Title is too long (150 max)."),
  description: z
    .string()
    .trim()
    .max(500, "Description is too long (500 max).")
    .transform((v) => (v === "" ? null : v)),
  points: z.coerce
    .number({ message: "Points must be a number." })
    .int("Points must be a whole number.")
    .min(0, "Points must be 0–100.")
    .max(100, "Points must be 0–100."),
});

export const activityIdSchema = z.strictObject({ id });
export const activityActiveSchema = z.strictObject({ id, active: z.boolean() });
export const activityMoveSchema = z.strictObject({ id, direction: z.enum(["up", "down"]) });

export const memberRoleSchema = z.strictObject({ userId: id, role: z.enum(["member", "admin"]) });
export const memberActiveSchema = z.strictObject({ userId: id, active: z.boolean() });
export const reopenWeekSchema = z.strictObject({ userId: id, weekStart: weekStartSchema });

export const memberIdParam = id;

export const memberSearchSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  sort: z.enum(["name", "recent", "submitted"]).catch("name"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

const isoDate = z.string().refine(isIsoDate, "Use YYYY-MM-DD.");
export const exportQuerySchema = z.strictObject({ from: isoDate, to: isoDate });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(190, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

const nextPath = z.string().max(300).optional();

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(PASSWORD_MAX),
  next: nextPath,
});

const displayName = z.string().trim().min(1, "Please enter your name.").max(100, "Name is too long.");

const newPassword = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

export const nameSchema = z.strictObject({ name: displayName });

export const changePasswordSchema = z
  .strictObject({
    current: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX),
    password: newPassword,
    confirm: z.string().max(PASSWORD_MAX),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match." })
  .refine((d) => d.password !== d.current, {
    path: ["password"],
    message: "Choose a password different from your current one.",
  });

export const registerSchema = z
  .strictObject({
    name: displayName,
    // New accounts only: login is not restricted, so existing members are never locked out.
    email: email.refine(isAllowedEmailDomain, `Please use a ${ALLOWED_PROVIDERS_TEXT} email address.`),
    password: newPassword,
    confirm: z.string().max(PASSWORD_MAX),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

// Not restricted to the allowed domains: any existing account may reset its password.
export const forgotPasswordSchema = z.strictObject({ email });

export const resetPasswordSchema = z
  .strictObject({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "This reset link is invalid."),
    password: newPassword,
    confirm: z.string().max(PASSWORD_MAX),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match." });
