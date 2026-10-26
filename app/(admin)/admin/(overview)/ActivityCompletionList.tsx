"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getActivityNotes } from "@/actions/admin";
import { BottomSheet } from "@/components/BottomSheet";
import { Toast, useToast } from "@/components/Toast";
import type { ActivityNote, Overview } from "@/lib/admin";
import { ACTIVITY_NOTES_LIMIT } from "@/lib/note";
import styles from "../admin.module.css";
import local from "./overview.module.css";

type Activity = Overview["perActivity"][number];

/** "Completion by activity" list. Activities with a note box open their members' notes. */
export function ActivityCompletionList({ activities }: { activities: Activity[] }) {
  const [notesFor, setNotesFor] = useState<Activity | null>(null);
  const [notes, setNotes] = useState<ActivityNote[] | null>(null);
  const [, startLoading] = useTransition();
  const [toast, showToast] = useToast();

  function openNotes(activity: Activity) {
    setNotesFor(activity);
    setNotes(null);
    startLoading(async () => {
      const res = await getActivityNotes({ id: activity.id });
      if (res.ok) {
        setNotes(res.notes);
      } else {
        setNotes([]);
        showToast(res.error, "error");
      }
    });
  }

  function body(a: Activity) {
    return (
      <>
        <span className={styles.grow}>
          <span className={styles.title}>{a.title}</span>
          <span className={styles.meter} aria-hidden="true">
            <span className={styles.meterFill} style={{ transform: `scaleX(${(a.rate ?? 0) / 100})` }} />
          </span>
          {(a.allowsNote || a.noteCount > 0) && (
            <span className={local.notesHint}>
              View notes ({a.noteCount}) <span aria-hidden="true">›</span>
            </span>
          )}
        </span>
        <span className={`${styles.value} num`}>{a.rate !== null ? `${a.rate}%` : "—"}</span>
      </>
    );
  }

  return (
    <>
      <ul className={`card ${styles.list}`}>
        {activities.map((a) =>
          a.allowsNote || a.noteCount > 0 ? (
            <li key={a.id}>
              <button type="button" className={`${styles.row} ${local.rowButton}`} onClick={() => openNotes(a)}>
                {body(a)}
              </button>
            </li>
          ) : (
            <li key={a.id} className={styles.row}>
              {body(a)}
            </li>
          ),
        )}
      </ul>

      <BottomSheet open={notesFor !== null} onClose={() => setNotesFor(null)} title="Members’ notes">
        {notesFor && <p className={local.notesFor}>{notesFor.title}</p>}
        {notes === null ? (
          <p className={local.muted} role="status">
            Loading…
          </p>
        ) : notes.length === 0 ? (
          <p className={local.muted}>No notes yet. They appear here when members tick this activity and write something.</p>
        ) : (
          <>
            <ul className={local.notes} aria-label="Notes">
              {notes.map((n, i) => (
                <li key={`${n.userId}-${n.weekStart}-${i}`} className={local.noteItem}>
                  <div className={local.noteHead}>
                    <Link href={`/admin/members/${n.userId}/${n.weekStart}`} className={local.noteName}>
                      {n.name}
                    </Link>
                    <span className={local.noteWeek}>
                      {n.weekLabel}
                      {n.submitted ? "" : " · draft"}
                    </span>
                  </div>
                  <p className={local.noteBody}>{n.note}</p>
                </li>
              ))}
            </ul>
            {notes.length >= ACTIVITY_NOTES_LIMIT && (
              <p className={local.muted}>Showing the latest {ACTIVITY_NOTES_LIMIT}. Use the CSV export for older notes.</p>
            )}
          </>
        )}
      </BottomSheet>

      <Toast toast={toast} />
    </>
  );
}
