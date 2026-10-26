"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteActivity,
  moveActivity,
  saveActivity,
  setActivityActive,
  type ActivityFormState,
  type AdminResult,
} from "@/actions/admin";
import { BottomSheet } from "@/components/BottomSheet";
import { Field } from "@/components/Field";
import { GroupTabs, panelId, tabId } from "@/components/GroupTabs";
import { Toast, useToast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import type { ActivityGroup, AdminActivity } from "@/lib/admin";
import { groupBy } from "@/lib/groups";
import formStyles from "@/components/Form.module.css";
import styles from "../admin.module.css";
import local from "./activities.module.css";

type Editing = AdminActivity | "new" | null;

const TABS_ID = "admin-groups";

export function ActivitiesManager({ activities, groups }: { activities: AdminActivity[]; groups: ActivityGroup[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminActivity | null>(null);
  const [busy, startTransition] = useTransition();
  const [toast, showToast] = useToast();

  // One tab per group (including empty ones), plus "Other" if some activities have no group.
  const grouped = groupBy(activities);
  const tabs = [
    ...groups.map((g) => ({
      key: String(g.id),
      name: g.name,
      items: grouped.find((x) => x.key === String(g.id))?.items ?? [],
    })),
    ...grouped.filter((x) => x.key === "other"),
  ];
  const [activeKey, setActiveKey] = useState(() => tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const defaultGroupId = current && current.key !== "other" ? Number(current.key) : null;

  function act(call: () => Promise<AdminResult>, success?: string) {
    startTransition(async () => {
      const res = await call();
      if (res.ok) {
        if (res.message ?? success) showToast(res.message ?? success ?? "");
      } else {
        showToast(res.error, "error");
      }
    });
  }

  return (
    <>
      <div className={local.toolbar}>
        <button type="button" className={styles.button} onClick={() => setEditing("new")}>
          + Add activity{current ? ` to ${current.name}` : ""}
        </button>
      </div>

      {!current ? (
        <p className={`card ${styles.empty}`}>No activities yet. Add the first one.</p>
      ) : (
        <>
          {tabs.length > 1 && (
            <GroupTabs
              idPrefix={TABS_ID}
              label="Activity groups"
              active={current.key}
              onChange={setActiveKey}
              tabs={tabs.map((t) => ({ key: t.key, label: t.name, badge: String(t.items.length) }))}
            />
          )}
          <div
            {...(tabs.length > 1
              ? { role: "tabpanel", id: panelId(TABS_ID, current.key), "aria-labelledby": tabId(TABS_ID, current.key) }
              : {})}
          >
            <p className={local.groupTitle}>
              <span>
                {current.items.filter((a) => a.isActive).length} of {current.items.length} active
              </span>
              <span className="num">
                {current.items.filter((a) => a.isActive).reduce((sum, a) => sum + a.points, 0)} pts
              </span>
            </p>
            {current.items.length === 0 ? (
              <p className={`card ${styles.empty}`}>No activities in {current.name} yet.</p>
            ) : (
            <ul className={`card ${styles.list}`} aria-label={current.name}>
            {current.items.map((a, i) => (
              <li key={a.id} className={`${styles.row} ${local.item}`} data-inactive={!a.isActive || undefined}>
                <div className={local.order}>
                  <button
                    type="button"
                    className={local.arrow}
                    aria-label={`Move ${a.title} up`}
                    disabled={busy || i === 0}
                    onClick={() => act(() => moveActivity({ id: a.id, direction: "up" }))}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={local.arrow}
                    aria-label={`Move ${a.title} down`}
                    disabled={busy || i === current.items.length - 1}
                    onClick={() => act(() => moveActivity({ id: a.id, direction: "down" }))}
                  >
                    ▼
                  </button>
                </div>

                <button type="button" className={local.main} onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}>
                  <span className={styles.title}>{a.title}</span>
                  {a.allowsNote && <span className={local.tag}>Has note box</span>}
                  {a.description && <span className={styles.sub}>{a.description}</span>}
                  <span className={styles.sub}>
                    {a.isActive ? "Active" : "Inactive"}
                    {a.usedIn > 0 ? ` · used in ${a.usedIn} week${a.usedIn === 1 ? "" : "s"}` : ""}
                  </span>
                </button>

                <span className={`${local.pill} num`}>+{a.points}</span>
                <Toggle
                  checked={a.isActive}
                  label={`${a.title} active`}
                  disabled={busy}
                  onChange={(next) =>
                    act(() => setActivityActive({ id: a.id, active: next }), next ? "Activated." : "Deactivated.")
                  }
                />
              </li>
            ))}
            </ul>
            )}
          </div>
        </>
      )}
      <p className={local.help}>
        Points changes apply to this week and future weeks. Submitted weeks keep the points they earned.
      </p>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add activity" : "Edit activity"}
      >
        {editing !== null && (
          <ActivityForm
            key={editing === "new" ? "new" : editing.id}
            activity={editing === "new" ? null : editing}
            groups={groups}
            defaultGroupId={defaultGroupId}
            onSaved={() => {
              setEditing(null);
              showToast("Saved.");
            }}
            onDelete={
              editing === "new"
                ? undefined
                : () => {
                    setDeleting(editing);
                    setEditing(null);
                  }
            }
          />
        )}
      </BottomSheet>

      <BottomSheet open={deleting !== null} onClose={() => setDeleting(null)} title="Delete activity?" dismissible={!busy}>
        {deleting && (
          <>
            <p className={local.sheetText}>
              {deleting.usedIn > 0
                ? `“${deleting.title}” appears in ${deleting.usedIn} week${deleting.usedIn === 1 ? "" : "s"}. It will be removed from the checklist, but past weeks keep it and their scores don't change.`
                : `“${deleting.title}” has never been used and will be permanently deleted.`}
            </p>
            <div className={local.sheetActions}>
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={() => {
                  const target = deleting;
                  startTransition(async () => {
                    const res = await deleteActivity({ id: target.id });
                    if (res.ok) {
                      setDeleting(null);
                      showToast(res.message ?? "Deleted.");
                    } else {
                      showToast(res.error, "error");
                    }
                  });
                }}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button type="button" className={local.cancel} onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </>
        )}
      </BottomSheet>

      <Toast toast={toast} />
    </>
  );
}

function ActivityForm({
  activity,
  groups,
  defaultGroupId,
  onSaved,
  onDelete,
}: {
  activity: AdminActivity | null;
  groups: ActivityGroup[];
  defaultGroupId: number | null;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [state, action, pending] = useActionState(saveActivity, {} as ActivityFormState);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.savedAt) onSaved();
    // Only react to a new successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <form action={action} className={formStyles.form} noValidate>
      {(state.error ?? errors.form) && (
        <p role="alert" className={formStyles.alert}>
          {state.error ?? errors.form}
        </p>
      )}
      <input type="hidden" name="id" value={activity?.id ?? ""} />
      <div className={`${formStyles.group} ${local.formGroup}`}>
        <Field name="title" label="Title" required maxLength={150} defaultValue={activity?.title} error={errors.title} />
        <Field
          name="description"
          label="Description (optional)"
          maxLength={500}
          defaultValue={activity?.description ?? ""}
          error={errors.description}
        />
        <Field
          name="points"
          label="Points (0–100)"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          required
          defaultValue={activity?.points ?? 1}
          error={errors.points}
        />
        <div className={formStyles.row}>
          <label htmlFor="activity-group" className={formStyles.label}>
            Group (checklist tab)
          </label>
          <select
            id="activity-group"
            name="groupId"
            className={`${formStyles.input} ${local.select}`}
            defaultValue={activity ? (activity.groupId ?? "") : (defaultGroupId ?? "")}
            aria-invalid={errors.groupId ? true : undefined}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="">Other (no group)</option>
          </select>
          {errors.groupId && <p className={formStyles.fieldError}>{errors.groupId}</p>}
        </div>
        <label className={`${formStyles.row} ${local.checkRow}`}>
          <input type="checkbox" name="allowsNote" defaultChecked={activity?.allowsNote ?? false} />
          <span>
            Members can add a note
            <span className={local.checkHint}>Shows a text box when ticked. Admins see it in the member’s week and the CSV.</span>
          </span>
        </label>
      </div>
      <button type="submit" className={formStyles.button} disabled={pending}>
        {pending ? "Saving…" : activity ? "Save changes" : "Add activity"}
      </button>
      {onDelete && (
        <button type="button" className={local.deleteLink} onClick={onDelete}>
          Delete activity…
        </button>
      )}
    </form>
  );
}
