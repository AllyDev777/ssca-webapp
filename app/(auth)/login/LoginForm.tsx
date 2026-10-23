"use client";

import { useActionState } from "react";
import { login, type AuthFormState } from "@/actions/auth";
import { Field } from "@/components/Field";
import styles from "@/components/Form.module.css";
import { PasswordField } from "@/components/PasswordField";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, {} as AuthFormState);

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
          defaultValue={state.values?.email}
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </div>
      {next && <input type="hidden" name="next" value={next} />}
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
