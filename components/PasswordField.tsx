"use client";

import { useState } from "react";
import { Field, fieldId, type FieldProps } from "./Field";
import { EyeIcon, EyeOffIcon } from "./icons";
import styles from "./Form.module.css";

/** Password row with a show/hide (eye) button. */
export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      // Keep revealed passwords out of autocorrect and spell-check services.
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={fieldId(props.name)}
        >
          {visible ? <EyeOffIcon width={20} height={20} /> : <EyeIcon width={20} height={20} />}
        </button>
      }
    />
  );
}
