"use client";

import { useState, useTransition } from "react";
import { reopenWeek } from "@/actions/admin";
import { BottomSheet } from "@/components/BottomSheet";
import { Toast, useToast } from "@/components/Toast";
import styles from "../../../admin.module.css";
import local from "../member.module.css";

export function ReopenWeek({ userId, weekStart }: { userId: number; weekStart: string }) {
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [toast, showToast] = useToast();

  return (
    <div style={{ marginTop: 24 }}>
      <button type="button" className={styles.secondary} style={{ width: "100%" }} onClick={() => setOpen(true)}>
        Reopen this week…
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Reopen this week?" dismissible={!busy}>
        <p className={local.sheetText}>
          The member will be able to change their ticks and must submit again. This is recorded in the audit log.
        </p>
        <div className={local.sheetActions}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const res = await reopenWeek({ userId, weekStart });
                if (res.ok) {
                  setOpen(false);
                  showToast(res.message ?? "Reopened.");
                } else {
                  showToast(res.error, "error");
                }
              })
            }
          >
            {busy ? "Reopening…" : "Reopen week"}
          </button>
          <button type="button" className={local.cancel} onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </BottomSheet>
      <Toast toast={toast} />
    </div>
  );
}
