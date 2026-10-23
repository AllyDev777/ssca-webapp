import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Form.module.css";

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /** Control shown at the end of the input (e.g. show-password button). */
  trailing?: ReactNode;
};

export function fieldId(name: string): string {
  return `field-${name}`;
}

/** One labelled row inside a `.group` card. */
export function Field({ name, label, error, hint, trailing, ...input }: FieldProps) {
  const id = fieldId(name);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.row}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          name={name}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className={styles.fieldHint}>
          {hint}
        </p>
      )}
    </div>
  );
}
