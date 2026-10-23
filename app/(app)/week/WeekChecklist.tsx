"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitWeek, toggleItem } from "@/actions/week";
import { BottomSheet } from "@/components/BottomSheet";
import { ChecklistRow } from "@/components/ChecklistRow";
import { LockIcon } from "@/components/icons";
import { ProgressRing } from "@/components/ProgressRing";
import { Toast, useToast } from "@/components/Toast";
import type { WeekItem } from "@/lib/assessments";
import formStyles from "@/components/Form.module.css";
import styles from "./week.module.css";

const SAVE_DELAY_MS = 400;

type Props = {
  weekStart: string;
  items: WeekItem[];
  editable: boolean;
  submittedAt: string | null;
  /** How the week is named in messages: "this week" or "last week" (late submission). */
  label?: string;
};

type Checks = Record<number, boolean>;

function initialChecks(items: WeekItem[]): Checks {
  return Object.fromEntries(items.map((i) => [i.activityId, i.completed]));
}

export function WeekChecklist({ weekStart, items, editable, submittedAt, label = "this week" }: Props) {
  const capitalised = label.charAt(0).toUpperCase() + label.slice(1);
  const [checks, setChecks] = useState<Checks>(() => initialChecks(items));
  const [animateId, setAnimateId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [toast, showToast] = useToast();

  // Last value the server confirmed / last value the user asked for, per activity.
  const confirmed = useRef<Checks>(initialChecks(items));
  const requested = useRef<Checks>(initialChecks(items));
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<Promise<void>>());

  // Optimistic total; the server recomputes its own on every save and on submit.
  const total = items.reduce((sum, i) => sum + (checks[i.activityId] ? i.points : 0), 0);
  const max = items.reduce((sum, i) => sum + i.points, 0);
  const doneCount = items.filter((i) => checks[i.activityId]).length;

  const save = useCallback(
    (activityId: number, completed: boolean): Promise<void> => {
      setPendingCount((n) => n + 1);
      const run = toggleItem({ weekStart, activityId, completed })
        .then((res) => {
          if (res.ok) {
            confirmed.current[activityId] = completed;
            showToast("Saved");
            return;
          }
          throw new Error(res.error);
        })
        .catch((err: unknown) => {
          // Roll back only if the user hasn't changed this row again since.
          if (requested.current[activityId] === completed && !timers.current.has(activityId)) {
            const value = confirmed.current[activityId] ?? false;
            requested.current[activityId] = value;
            setChecks((c) => ({ ...c, [activityId]: value }));
          }
          showToast(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.", "error");
        })
        .finally(() => {
          inflight.current.delete(run);
          setPendingCount((n) => n - 1);
        });
      inflight.current.add(run);
      return run;
    },
    [weekStart, showToast],
  );

  function toggle(activityId: number) {
    if (!editable) return;
    const next = !checks[activityId];
    requested.current[activityId] = next;
    setChecks((c) => ({ ...c, [activityId]: next }));
    setAnimateId(next ? activityId : null);

    // Debounce per row: rapid taps on one row send only the final state.
    clearTimeout(timers.current.get(activityId));
    timers.current.set(
      activityId,
      setTimeout(() => {
        timers.current.delete(activityId);
        void save(activityId, next);
      }, SAVE_DELAY_MS),
    );
  }

  /** Sends any debounced saves now and waits for every request to finish. */
  async function flush() {
    for (const [activityId, timer] of timers.current) {
      clearTimeout(timer);
      timers.current.delete(activityId);
      void save(activityId, requested.current[activityId] ?? false);
    }
    await Promise.all(inflight.current);
  }

  // Warn before leaving with unsaved taps.
  const unsaved = pendingCount > 0;
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function confirmSubmit() {
    startSubmit(async () => {
      await flush();
      const res = await submitWeek({ weekStart });
      if (res.ok) {
        setSheetOpen(false);
        showToast("Week submitted. God bless!");
      } else {
        showToast(res.error, "error");
      }
      // On success the action revalidates /week, which re-renders this with editable=false.
    });
  }

  const submitted = submittedAt !== null;

  return (
    <>
      <section className={`card glass-strong ${styles.summary}`} aria-label="Weekly progress">
        <ProgressRing value={total} max={max} />
        <div className={styles.summaryText}>
          <p className={`${styles.score} num`}>
            {total} / {max} pts
          </p>
          <p className={`${styles.meta} num`}>
            {doneCount} of {items.length} activities done
          </p>
          <p className={styles.status} data-state={submitted ? "submitted" : editable ? "draft" : "locked"}>
            {submitted
              ? `Submitted ${submittedAt}`
              : editable
                ? unsaved
                  ? "Saving…"
                  : "Draft · saved automatically"
                : "Not submitted · week closed"}
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <p className={`card ${styles.empty}`}>No activities have been set up yet. Please check back soon.</p>
      ) : (
        <ul className={`card ${styles.list}`} aria-label="Activities">
          {items.map((item) => (
            <ChecklistRow
              key={item.activityId}
              id={item.activityId}
              title={item.title}
              description={item.description}
              points={item.points}
              checked={checks[item.activityId] ?? false}
              disabled={!editable}
              animate={animateId === item.activityId}
              onToggle={() => toggle(item.activityId)}
            />
          ))}
        </ul>
      )}

      {editable ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${formStyles.button} ${styles.submit}`}
            onClick={() => setSheetOpen(true)}
            disabled={items.length === 0}
          >
            Submit Week
          </button>
          <p className={styles.note}>Your ticks save as you go. Submit when your week is complete.</p>
        </div>
      ) : (
        <p className={styles.locked}>
          <LockIcon width={18} height={18} />
          {submitted ? `${capitalised} is submitted and locked.` : `${capitalised} has ended and is locked.`}
        </p>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`Submit ${label}?`}
        dismissible={!submitting}
      >
        <p className={styles.sheetText}>
          You’ll submit <strong className="num">{total} of {max} points</strong> ({doneCount} of {items.length}{" "}
          activities). After submitting, {label} can’t be changed.
        </p>
        <div className={styles.sheetActions}>
          <button type="button" className={formStyles.button} onClick={confirmSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Week"}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => setSheetOpen(false)}
            disabled={submitting}
          >
            Not yet
          </button>
        </div>
      </BottomSheet>

      <Toast toast={toast} />
    </>
  );
}
