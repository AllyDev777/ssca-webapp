"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./BottomSheet.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** False while an action runs, so Escape/backdrop can't close mid-request. */
  dismissible?: boolean;
  children: React.ReactNode;
};

/**
 * Confirmation sheet built on the native modal <dialog>: the browser traps focus,
 * makes the page behind inert, restores focus on close and handles Escape.
 */
export function BottomSheet({ open, onClose, title, dismissible = true, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClick={(e) => {
        // Clicks on the ::backdrop are dispatched to the <dialog> itself.
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div className={styles.body}>
        <div className={styles.grabber} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
