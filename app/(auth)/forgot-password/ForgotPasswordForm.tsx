"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ForgotFormState } from "@/actions/password-reset";
import { Field } from "@/components/Field";
import styles from "@/components/Form.module.css";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as ForgotFormState);

  if (state.sent) {
    return (
      <p className={styles.notice} role="status">
        If an account exists for {state.email}, we’ve sent a reset link. It expires in 60 minutes. Check your spam folder
        if you don’t see it.
      </p>
    );
  }

  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && (
        <p role="alert" className={styles.alert}>
          {state.error}
        </p>
      )}
      <div className={styles.group}>
        <Field
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={190}
          required
          defaultValue={state.email}
          error={state.fieldErrors?.email}
        />
      </div>
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
