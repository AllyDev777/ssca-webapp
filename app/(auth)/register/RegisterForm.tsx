"use client";

import { useActionState } from "react";
import { register, type AuthFormState } from "@/actions/auth";
import { Field } from "@/components/Field";
import styles from "@/components/Form.module.css";
import { PasswordField } from "@/components/PasswordField";
import { ALLOWED_PROVIDERS_TEXT } from "@/lib/email-domains";
import { PASSWORD_MIN } from "@/lib/password-rules";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, {} as AuthFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && (
        <p role="alert" className={styles.alert}>
          {state.error}
        </p>
      )}
      <div className={styles.group}>
        <Field
          name="name"
          label="Name"
          autoComplete="name"
          maxLength={100}
          required
          defaultValue={state.values?.name}
          error={errors.name}
        />
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
          error={errors.email}
          hint={`${ALLOWED_PROVIDERS_TEXT} addresses only.`}
        />
      </div>
      <div className={styles.group}>
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={128}
          required
          error={errors.password}
        />
        <PasswordField
          name="confirm"
          label="Confirm password"
          autoComplete="new-password"
          maxLength={128}
          required
          error={errors.confirm}
        />
      </div>
      <p className={styles.hint}>At least {PASSWORD_MIN} characters. Avoid common passwords.</p>
      <button type="submit" className={styles.button} disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
