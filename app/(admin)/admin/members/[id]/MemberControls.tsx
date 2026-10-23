"use client";

import { useState, useTransition } from "react";
import { setMemberActive, setMemberRole, type AdminResult } from "@/actions/admin";
import { BottomSheet } from "@/components/BottomSheet";
import { Toast, useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import styles from "../../admin.module.css";
import local from "./member.module.css";

type Props = { userId: number; role: "member" | "admin"; isActive: boolean; isSelf: boolean };
type Pending = { kind: "role"; role: "member" | "admin" } | { kind: "active"; active: boolean } | null;

export function MemberControls({ userId, role, isActive, isSelf }: Props) {
  const [confirm, setConfirm] = useState<Pending>(null);
  const [busy, startTransition] = useTransition();
  const [toast, showToast] = useToast();

  function run() {
    const target = confirm;
    if (!target) return;
    startTransition(async () => {
      const res: AdminResult =
        target.kind === "role"
          ? await setMemberRole({ userId, role: target.role })
          : await setMemberActive({ userId, active: target.active });
      if (res.ok) {
        setConfirm(null);
        showToast(res.message ?? "Saved.");
      } else {
        showToast(res.error, "error");
      }
    });
  }

  const sheetTitle =
    confirm?.kind === "role"
      ? confirm.role === "admin"
        ? "Make this member an admin?"
        : "Remove admin access?"
      : confirm?.active
        ? "Reactivate account?"
        : "Deactivate account?";

  const sheetText =
    confirm?.kind === "role"
      ? "They will be signed out on all devices and must sign in again."
      : confirm?.active
        ? "They will be able to sign in again."
        : "They will be signed out immediately and can't sign in. Their history is kept.";

  return (
    <>
      <div className={local.controls}>
        <div className={local.line}>
          <span className={styles.grow}>
            <span className={styles.title}>Role</span>
            <span className={styles.sub}>{role === "admin" ? "Admin" : "Member"}</span>
          </span>
          <button
            type="button"
            className={styles.secondary}
            disabled={isSelf || busy}
            onClick={() => setConfirm({ kind: "role", role: role === "admin" ? "member" : "admin" })}
          >
            {role === "admin" ? "Make member" : "Make admin"}
          </button>
        </div>
        <div className={local.line}>
          <span className={styles.grow}>
            <span className={styles.title}>Account active</span>
            <span className={styles.sub}>{isActive ? "Can sign in" : "Deactivated"}</span>
          </span>
          <Toggle
            checked={isActive}
            label="Account active"
            disabled={isSelf || busy}
            onChange={(next) => setConfirm({ kind: "active", active: next })}
          />
        </div>
        {isSelf && <p className={styles.sub}>You can’t change your own role or deactivate yourself.</p>}
      </div>

      <BottomSheet open={confirm !== null} onClose={() => setConfirm(null)} title={sheetTitle} dismissible={!busy}>
        <p className={local.sheetText}>{sheetText}</p>
        <div className={local.sheetActions}>
          <button
            type="button"
            className={confirm?.kind === "active" && !confirm.active ? styles.danger : styles.button}
            onClick={run}
            disabled={busy}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button type="button" className={local.cancel} onClick={() => setConfirm(null)} disabled={busy}>
            Cancel
          </button>
        </div>
      </BottomSheet>
      <Toast toast={toast} />
    </>
  );
}
