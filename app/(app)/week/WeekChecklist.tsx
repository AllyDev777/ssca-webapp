"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveItemNote, submitWeek, toggleItem } from "@/actions/week";
import { BottomSheet } from "@/components/BottomSheet";
import { ChecklistRow } from "@/components/ChecklistRow";
import { GroupTabs, panelId, tabId } from "@/components/GroupTabs";
import { LockIcon } from "@/components/icons";
import { ProgressRing } from "@/components/ProgressRing";
import { Toast, useToast } from "@/components/Toast";
import type { WeekItem } from "@/lib/assessments";
import { groupBy } from "@/lib/groups";
import { NOTE_MAX } from "@/lib/note";
import formStyles from "@/components/Form.module.css";
import rowStyles from "@/components/ChecklistRow.module.css";
import styles from "./week.module.css";

const SAVE_DELAY_MS = 400;
const NOTE_DELAY_MS = 800;
const TABS_ID = "week-groups";

type Props = {
  weekStart: string;
  items: WeekItem[];
  editable: boolean;
  submittedAt: string | null;
  /** How the week is named in messages: "this week" or "last week" (late submission). */
  label?: string;
};

type Checks = Record<number, boolean>;
type Notes = Record<number, string>;
type NoteState = "saving" | "saved" | "error";

function initialChecks(items: WeekItem[]): Checks {
  return Object.fromEntries(items.map((i) => [i.activityId, i.completed]));
}

function initialNotes(items: WeekItem[]): Notes {
  return Object.fromEntries(items.filter((i) => i.allowsNote).map((i) => [i.activityId, i.note ?? ""]));
}

export function WeekChecklist({ weekStart, items, editable, submittedAt, label = "this week" }: Props) {
  const capitalised = label.charAt(0).toUpperCase() + label.slice(1);
  const groups = useMemo(() => groupBy(items), [items]);
  const [activeGroup, setActiveGroup] = useState(() => groups[0]?.key ?? "");
  const [checks, setChecks] = useState<Checks>(() => initialChecks(items));
  const [notes, setNotes] = useState<Notes>(() => initialNotes(items));
  const [noteState, setNoteState] = useState<Record<number, NoteState>>({});
  const [animateId, setAnimateId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [toast, showToast] = useToast();
  const tabsRef = useRef<HTMLDivElement>(null);

  // Last value the server confirmed / last value the user asked for, per activity.
  const confirmed = useRef<Checks>(initialChecks(items));
  const requested = useRef<Checks>(initialChecks(items));
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const noteTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const latestNotes = useRef<Notes>(initialNotes(items));
  const inflight = useRef(new Set<Promise<void>>());

  // Optimistic total; the server recomputes its own on every save and on submit.
  const total = items.reduce((sum, i) => sum + (checks[i.activityId] ? i.points : 0), 0);
  const max = items.reduce((sum, i) => sum + i.points, 0);
  const doneCount = items.filter((i) => checks[i.activityId]).length;

  const track = useCallback((run: Promise<void>) => {
    setPendingCount((n) => n + 1);
    inflight.current.add(run);
    void run.finally(() => {
      inflight.current.delete(run);
      setPendingCount((n) => n - 1);
    });
  }, []);

  const save = useCallback(
    (activityId: number, completed: boolean): Promise<void> => {
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
        });
      track(run);
      return run;
    },
    [weekStart, showToast, track],
  );

  const saveNote = useCallback(
    (activityId: number): Promise<void> => {
      const note = latestNotes.current[activityId] ?? "";
      setNoteState((s) => ({ ...s, [activityId]: "saving" }));
      const run = saveItemNote({ weekStart, activityId, note }).then(
        (res) => {
          // A newer edit may already be queued; only report on the latest text.
          if (latestNotes.current[activityId] !== note || noteTimers.current.has(activityId)) return;
          setNoteState((s) => ({ ...s, [activityId]: res.ok ? "saved" : "error" }));
          if (!res.ok) showToast(res.error, "error");
        },
        () => {
          setNoteState((s) => ({ ...s, [activityId]: "error" }));
          showToast("Couldn't save your note. Please try again.", "error");
        },
      );
      track(run);
      return run;
    },
    [weekStart, showToast, track],
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

  function editNote(activityId: number, value: string) {
    const text = value.slice(0, NOTE_MAX);
    latestNotes.current[activityId] = text;
    setNotes((n) => ({ ...n, [activityId]: text }));
    setNoteState((s) => ({ ...s, [activityId]: "saving" }));
    clearTimeout(noteTimers.current.get(activityId));
    noteTimers.current.set(
      activityId,
      setTimeout(() => {
        noteTimers.current.delete(activityId);
        void saveNote(activityId);
      }, NOTE_DELAY_MS),
    );
  }

  function flushNote(activityId: number) {
    const timer = noteTimers.current.get(activityId);
    if (!timer) return;
    clearTimeout(timer);
    noteTimers.current.delete(activityId);
    void saveNote(activityId);
  }

  /** Sends any debounced saves now and waits for every request to finish. */
  async function flush() {
    for (const [activityId, timer] of timers.current) {
      clearTimeout(timer);
      timers.current.delete(activityId);
      void save(activityId, requested.current[activityId] ?? false);
    }
    for (const activityId of [...noteTimers.current.keys()]) flushNote(activityId);
    await Promise.all(inflight.current);
  }

  // Warn before leaving with unsaved changes.
  const unsaved = pendingCount > 0;
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  useEffect(() => {
    const pending = timers.current;
    const pendingNotes = noteTimers.current;
    return () => {
      pending.forEach(clearTimeout);
      pendingNotes.forEach(clearTimeout);
    };
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

  function goToGroup(key: string) {
    setActiveGroup(key);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tabsRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }

  const submitted = submittedAt !== null;
  const tabbed = groups.length > 1;
  const current = groups.find((g) => g.key === activeGroup) ?? groups[0];
  const nextGroup = current ? groups[groups.indexOf(current) + 1] : undefined;
  const visible = tabbed ? (current?.items ?? []) : items;

  function renderRow(item: WeekItem) {
    const checked = checks[item.activityId] ?? false;
    const note = notes[item.activityId] ?? "";
    const noteId = `note-${item.activityId}`;
    const state = noteState[item.activityId];
    return (
      <ChecklistRow
        key={item.activityId}
        id={item.activityId}
        title={item.title}
        description={item.description}
        points={item.points}
        checked={checked}
        disabled={!editable}
        animate={animateId === item.activityId}
        onToggle={() => toggle(item.activityId)}
      >
        {item.allowsNote && checked && editable && (
          <div className={rowStyles.extra}>
            <label htmlFor={noteId} className={rowStyles.noteLabel}>
              What did you do?
            </label>
            <textarea
              id={noteId}
              className={rowStyles.noteInput}
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder="E.g. spoke about the Society at our parish retreat"
              onChange={(e) => editNote(item.activityId, e.target.value)}
              onBlur={() => flushNote(item.activityId)}
            />
            <div className={rowStyles.noteMeta}>
              <span aria-live="polite" data-state={state}>
                {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : ""}
              </span>
              <span className="num">
                {note.length}/{NOTE_MAX}
              </span>
            </div>
          </div>
        )}
        {item.allowsNote && checked && !editable && note && (
          <div className={rowStyles.extra}>
            <p className={rowStyles.noteText}>{note}</p>
          </div>
        )}
      </ChecklistRow>
    );
  }

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
        <>
          {tabbed && (
            <div ref={tabsRef}>
              <GroupTabs
                idPrefix={TABS_ID}
                label="Activity groups"
                active={current?.key ?? ""}
                onChange={setActiveGroup}
                tabs={groups.map((g) => {
                  const done = g.items.filter((i) => checks[i.activityId]).length;
                  return { key: g.key, label: g.name, badge: `${done}/${g.items.length}`, complete: done === g.items.length };
                })}
              />
            </div>
          )}
          <div
            {...(tabbed && current
              ? { role: "tabpanel", id: panelId(TABS_ID, current.key), "aria-labelledby": tabId(TABS_ID, current.key) }
              : {})}
          >
            <ul className={`card ${styles.list}`} aria-label={tabbed && current ? current.name : "Activities"}>
              {visible.map(renderRow)}
            </ul>
            {tabbed && nextGroup && (
              <button type="button" className={styles.nextGroup} onClick={() => goToGroup(nextGroup.key)}>
                Next: {nextGroup.name} ›
              </button>
            )}
          </div>
        </>
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
