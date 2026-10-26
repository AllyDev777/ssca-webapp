import "server-only";
import type { PoolConnection } from "mysql2/promise";
import { execute, query, queryOne, transaction, type Db } from "./db";
import { GROUPED_ORDER } from "./groups";
import { editingClosesAt, formatDateTime, isWeekEditable, openLateWeek } from "./week";

/**
 * Weekly assessment data. Every function takes the owner's userId from the
 * session (never from the client) and filters by it.
 *
 * Draft rows mirror the *current* activities: titles/points are refreshed on each
 * load/toggle, and items for deactivated activities are hidden and excluded from
 * totals. On submit the snapshot freezes, so later activity edits never change it.
 */

export type WeekStatus = "draft" | "submitted";

export type WeekItem = {
  activityId: number;
  title: string;
  description: string | null;
  points: number;
  completed: boolean;
  groupId: number | null;
  groupName: string | null;
  /** The activity shows a free-text box when ticked. */
  allowsNote: boolean;
  note: string | null;
};

export type WeekView = {
  weekStart: string;
  status: WeekStatus | "none"; // "none": the member never opened that week
  items: WeekItem[];
  total: number;
  max: number;
  submittedAt: string | null; // formatted in IST
  editable: boolean;
};

export type Totals = { total: number; max: number };

// Constant SQL fragment (no user input) for "activity is currently offered".
const ACTIVE = "a.is_active = 1 AND a.deleted_at IS NULL";

type AssessmentRow = { id: number; status: WeekStatus };

/** Gets or creates the (user, week) assessment and locks its row until the transaction ends. */
export async function lockAssessment(userId: number, weekStart: string, conn: PoolConnection): Promise<AssessmentRow> {
  await execute(
    "INSERT INTO weekly_assessments (user_id, week_start) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id",
    [userId, weekStart],
    conn,
  );
  const row = await queryOne<AssessmentRow>(
    "SELECT id, status FROM weekly_assessments WHERE user_id = ? AND week_start = ? FOR UPDATE",
    [userId, weekStart],
    conn,
  );
  if (!row) throw new Error("Assessment row missing after upsert");
  return row;
}

/** Adds rows for newly active activities and refreshes title/points snapshots on a draft. */
export async function syncDraftItems(assessmentId: number, db: Db): Promise<void> {
  await execute(
    `INSERT INTO assessment_items (assessment_id, activity_id, activity_title, points_awarded)
     SELECT ?, a.id, a.title, a.points FROM activities a WHERE ${ACTIVE}
     ON DUPLICATE KEY UPDATE activity_title = a.title, points_awarded = a.points`,
    [assessmentId],
    db,
  );
}

/** Recomputes a draft's totals from its items (never from client input). */
export async function recomputeTotals(assessmentId: number, db: Db): Promise<Totals> {
  await execute(
    `UPDATE weekly_assessments wa
        SET wa.total_points = (
              SELECT COALESCE(SUM(ai.points_awarded), 0)
                FROM assessment_items ai JOIN activities a ON a.id = ai.activity_id
               WHERE ai.assessment_id = wa.id AND ai.completed = 1 AND ${ACTIVE}),
            wa.max_points = (
              SELECT COALESCE(SUM(ai.points_awarded), 0)
                FROM assessment_items ai JOIN activities a ON a.id = ai.activity_id
               WHERE ai.assessment_id = wa.id AND ${ACTIVE})
      WHERE wa.id = ? AND wa.status = 'draft'`,
    [assessmentId],
    db,
  );
  const row = await queryOne<{ total_points: number; max_points: number }>(
    "SELECT total_points, max_points FROM weekly_assessments WHERE id = ?",
    [assessmentId],
    db,
  );
  return { total: Number(row?.total_points ?? 0), max: Number(row?.max_points ?? 0) };
}

/** Removes draft items for inactive activities so the submitted snapshot is exactly what counted. */
export async function pruneInactiveItems(assessmentId: number, db: Db): Promise<void> {
  await execute(
    `DELETE ai FROM assessment_items ai JOIN activities a ON a.id = ai.activity_id
      WHERE ai.assessment_id = ? AND NOT (${ACTIVE})`,
    [assessmentId],
    db,
  );
}

/** Last week, if it's still in the late-submission window and this member hasn't submitted it. */
export async function getOpenLateWeek(userId: number): Promise<{ weekStart: string; deadline: string } | null> {
  const weekStart = openLateWeek();
  if (!weekStart) return null;
  const row = await queryOne<{ status: WeekStatus }>(
    "SELECT status FROM weekly_assessments WHERE user_id = ? AND week_start = ?",
    [userId, weekStart],
  );
  if (row?.status === "submitted") return null;
  // Show the last minute it's open ("Mon 26 Oct, 11:59 pm"), not the instant it closes.
  return { weekStart, deadline: formatDateTime(new Date(editingClosesAt(weekStart).getTime() - 60_000)) };
}

/**
 * True if the week has no row yet, or it's a draft whose items/totals don't match the
 * current activities. Any activation, deactivation or points change alters the active
 * points sum, so comparing it with the stored max_points catches all of them.
 */
async function draftNeedsSync(userId: number, weekStart: string): Promise<boolean> {
  const row = await queryOne<{ stale: number | null }>(
    `SELECT (wa.id IS NULL) OR (wa.status = 'draft' AND (
              wa.max_points <> (SELECT COALESCE(SUM(a.points), 0) FROM activities a WHERE ${ACTIVE})
              OR EXISTS (
                SELECT 1 FROM activities a
                  LEFT JOIN assessment_items ai ON ai.assessment_id = wa.id AND ai.activity_id = a.id
                 WHERE ${ACTIVE}
                   AND (ai.id IS NULL OR ai.points_awarded <> a.points OR BINARY ai.activity_title <> BINARY a.title)))
            ) AS stale
       FROM (SELECT 1) AS one
       LEFT JOIN weekly_assessments wa ON wa.user_id = ? AND wa.week_start = ?`,
    [userId, weekStart],
  );
  return Number(row?.stale ?? 1) === 1;
}

type ItemRow = {
  activity_id: number;
  title: string;
  description: string | null;
  points: number;
  completed: number;
  note: string | null;
  allows_note: number;
  group_id: number | null;
  group_name: string | null;
};
type ViewRow = { id: number; status: WeekStatus; total_points: number; max_points: number; submitted_at: Date | null };

/**
 * Loads one week for one member. For an editable week this also creates the draft
 * and syncs it with the current activities, so the checklist is always complete.
 */
export async function loadWeek(
  userId: number,
  weekStart: string,
  { readOnly = false }: { readOnly?: boolean } = {},
): Promise<WeekView> {
  // readOnly (admin viewing a member): never create or modify the member's rows.
  const editable = !readOnly && isWeekEditable(weekStart);

  // The write transaction only runs when the draft is missing or out of date
  // (activity added/removed/re-pointed/renamed). Usually it's a single read.
  if (editable && (await draftNeedsSync(userId, weekStart))) {
    await transaction(async (conn) => {
      const a = await lockAssessment(userId, weekStart, conn);
      if (a.status === "draft") {
        await syncDraftItems(a.id, conn);
        await recomputeTotals(a.id, conn);
      }
    });
  }

  const row = await queryOne<ViewRow>(
    `SELECT id, status, total_points, max_points, submitted_at
       FROM weekly_assessments WHERE user_id = ? AND week_start = ?`,
    [userId, weekStart],
  );
  if (!row) {
    return { weekStart, status: "none", items: [], total: 0, max: 0, submittedAt: null, editable: false };
  }

  // Drafts hide deactivated activities; submitted weeks show their frozen snapshot.
  const items = await query<ItemRow>(
    `SELECT ai.activity_id, ai.activity_title AS title, a.description, ai.points_awarded AS points, ai.completed,
            ai.note, a.allows_note, g.id AS group_id, g.name AS group_name
       FROM assessment_items ai
       JOIN activities a ON a.id = ai.activity_id
       LEFT JOIN activity_groups g ON g.id = a.group_id
      WHERE ai.assessment_id = ? ${row.status === "draft" ? `AND ${ACTIVE}` : ""}
      ORDER BY ${GROUPED_ORDER}`,
    [row.id],
  );

  return {
    weekStart,
    status: row.status,
    items: items.map((i) => ({
      activityId: i.activity_id,
      title: i.title,
      description: i.description,
      points: Number(i.points),
      completed: Number(i.completed) === 1,
      groupId: i.group_id,
      groupName: i.group_name,
      allowsNote: Number(i.allows_note) === 1,
      note: i.note,
    })),
    total: Number(row.total_points),
    max: Number(row.max_points),
    submittedAt: row.submitted_at ? formatDateTime(row.submitted_at) : null,
    editable: editable && row.status === "draft",
  };
}
