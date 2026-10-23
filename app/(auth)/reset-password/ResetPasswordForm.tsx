"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword, type ResetFormState } from "@/actions/password-reset";
import styles from "@/components/Form.module.css";
import { PasswordField } from "@/components/PasswordField";
import { PASSWORD_MIN } from "@/lib/password-rules";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, {} as ResetFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && (
        <p role="alert" className={styles.alert}>
          {state.error} <Link href="/forgot-password">Request a new link</Link>
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      <div className={styles.group}>
        <PasswordField
          name="password"
          label="New password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={128}
          required
          error={errors.password}
        />
        <PasswordField
          name="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          maxLength={128}
          required
          error={errors.confirm}
        />
      </div>
      <p className={styles.hint}>At least {PASSWORD_MIN} characters. Avoid common passwords.</p>
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
