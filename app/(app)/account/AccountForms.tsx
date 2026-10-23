"use client";

import { useActionState, useTransition } from "react";
import { changePassword, signOutOtherDevices, updateName, type AccountFormState } from "@/actions/account";
import { Field } from "@/components/Field";
import { PasswordField } from "@/components/PasswordField";
import { Toast, useToast } from "@/components/Toast";
import formStyles from "@/components/Form.module.css";
import { PASSWORD_MIN } from "@/lib/password-rules";
import styles from "./account.module.css";

function Feedback({ state }: { state: AccountFormState }) {
  if (state.error) {
    return (
      <p role="alert" className={formStyles.alert}>
        {state.error}
      </p>
    );
  }
  // Keyed by savedAt so the confirmation is announced again on every save.
  return state.message ? (
    <p key={state.savedAt} role="status" className={styles.success}>
      {state.message}
    </p>
  ) : null;
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateName, {} as AccountFormState);
  return (
    <form action={action} className={formStyles.form} noValidate>
      <Feedback state={state} />
      <div className={formStyles.group}>
        <Field
          name="name"
          label="Display name"
          autoComplete="name"
          maxLength={100}
          required
          defaultValue={name}
          error={state.fieldErrors?.name}
        />
      </div>
      <button type="submit" className={formStyles.button} disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {} as AccountFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className={formStyles.form} noValidate>
      <Feedback state={state} />
      <div className={formStyles.group}>
        <PasswordField
          name="current"
          label="Current password"
          autoComplete="current-password"
          maxLength={128}
          required
          error={errors.current}
        />
      </div>
      <div className={formStyles.group}>
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
      <p className={formStyles.hint}>
        At least {PASSWORD_MIN} characters. Changing it signs you out on your other devices.
      </p>
      <button type="submit" className={formStyles.button} disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

export function OtherDevicesButton({ otherDevices }: { otherDevices: number }) {
  const [busy, startTransition] = useTransition();
  const [toast, showToast] = useToast();
  return (
    <>
      <button
        type="button"
        className={styles.secondary}
        disabled={busy || otherDevices === 0}
        onClick={() =>
          startTransition(async () => {
            const res = await signOutOtherDevices();
            showToast(res.ok ? res.message : res.error, res.ok ? "ok" : "error");
          })
        }
      >
        {busy ? "Signing out…" : "Sign out other devices"}
      </button>
      <Toast toast={toast} />
    </>
  );
}
