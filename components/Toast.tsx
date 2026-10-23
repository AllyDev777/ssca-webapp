"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

export type ToastTone = "ok" | "error";
type ToastMessage = { id: number; text: string; tone: ToastTone };

/** Small transient message. Errors stay longer than confirmations. */
export function useToast(): [ToastMessage | null, (text: string, tone?: ToastTone) => void] {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string, tone: ToastTone = "ok") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), tone === "error" ? 5000 : 1600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, show];
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  // The live region stays mounted so screen readers announce each new message.
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={styles.toast} data-tone={toast.tone}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
