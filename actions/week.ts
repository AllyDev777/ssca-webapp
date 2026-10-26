"use server";

import { revalidatePath } from "next/cache";
import {
  lockAssessment,
  pruneInactiveItems,
  recomputeTotals,
  syncDraftItems,
  type Totals,
} from "@/lib/assessments";
import { requireUser } from "@/lib/auth";
import { execute, transaction } from "@/lib/db";
import { hitMutationLimit } from "@/lib/rate-limit";
import { saveNoteSchema, submitWeekSchema, toggleItemSchema } from "@/lib/validation";
import { isWeekEditable } from "@/lib/week";

export type WeekActionResult = ({ ok: true } & Totals) | { ok: false; error: string };

const CLOSED = "This week is closed and can no longer be changed.";
const SUBMITTED = "This week has already been submitted.";
const TOO_FAST = "You're going a little fast — please wait a moment and try again.";
const UNEXPECTED = "Couldn't save. Check your connection and try again.";

/** Sets one activity's completed state on the member's own draft for that week. */
export async function toggleItem(input: unknown): Promise<WeekActionResult> {
  const user = await requireUser();
  const parsed = toggleItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { weekStart, activityId, completed } = parsed.data;
  if (!isWeekEditable(weekStart)) return { ok: false, error: CLOSED };

  try {
    if (!(await hitMutationLimit(user.id)).ok) return { ok: false, error: TOO_FAST };

    return await transaction(async (conn): Promise<WeekActionResult> => {
      const assessment = await lockAssessment(user.id, weekStart, conn);
      if (assessment.status !== "draft") return { ok: false, error: SUBMITTED };

      // Refreshes points_awarded from the activity's current points before saving.
      await syncDraftItems(assessment.id, conn);
      const result = await execute(
        `UPDATE assessment_items ai JOIN activities a ON a.id = ai.activity_id
            SET ai.completed = ?
          WHERE ai.assessment_id = ? AND ai.activity_id = ? AND a.is_active = 1 AND a.deleted_at IS NULL`,
        [completed ? 1 : 0, assessment.id, activityId],
        conn,
      );
      if (result.affectedRows === 0) return { ok: false, error: "That activity is no longer available." };

      return { ok: true, ...(await recomputeTotals(assessment.id, conn)) };
    });
  } catch (err) {
    console.error("[week] toggleItem failed:", err);
    return { ok: false, error: UNEXPECTED };
  }
}

export type NoteResult = { ok: true } | { ok: false; error: string };

/** Saves the member's free-text note for one activity (only activities that allow notes). */
export async function saveItemNote(input: unknown): Promise<NoteResult> {
  const user = await requireUser();
  const parsed = saveNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const { weekStart, activityId, note } = parsed.data;
  if (!isWeekEditable(weekStart)) return { ok: false, error: CLOSED };

  try {
    if (!(await hitMutationLimit(user.id)).ok) return { ok: false, error: TOO_FAST };

    return await transaction(async (conn): Promise<NoteResult> => {
      const assessment = await lockAssessment(user.id, weekStart, conn);
      if (assessment.status !== "draft") return { ok: false, error: SUBMITTED };

      await syncDraftItems(assessment.id, conn);
      const result = await execute(
        `UPDATE assessment_items ai JOIN activities a ON a.id = ai.activity_id
            SET ai.note = ?
          WHERE ai.assessment_id = ? AND ai.activity_id = ?
            AND a.allows_note = 1 AND a.is_active = 1 AND a.deleted_at IS NULL`,
        [note, assessment.id, activityId],
        conn,
      );
      if (result.affectedRows === 0) return { ok: false, error: "Notes can't be added to that activity." };
      return { ok: true };
    });
  } catch (err) {
    console.error("[week] saveItemNote failed:", err);
    return { ok: false, error: UNEXPECTED };
  }
}

/** Locks the member's week: freezes the snapshot and server-computed totals. */
export async function submitWeek(input: unknown): Promise<WeekActionResult> {
  const user = await requireUser();
  const parsed = submitWeekSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { weekStart } = parsed.data;
  if (!isWeekEditable(weekStart)) return { ok: false, error: CLOSED };

  let result: WeekActionResult;
  try {
    if (!(await hitMutationLimit(user.id)).ok) return { ok: false, error: TOO_FAST };

    result = await transaction(async (conn): Promise<WeekActionResult> => {
      const assessment = await lockAssessment(user.id, weekStart, conn); // SELECT … FOR UPDATE
      if (assessment.status !== "draft") return { ok: false, error: SUBMITTED };

      await syncDraftItems(assessment.id, conn);
      await pruneInactiveItems(assessment.id, conn);
      const totals = await recomputeTotals(assessment.id, conn);
      await execute(
        "UPDATE weekly_assessments SET status = 'submitted', submitted_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'draft'",
        [assessment.id],
        conn,
      );
      return { ok: true, ...totals };
    });
  } catch (err) {
    console.error("[week] submitWeek failed:", err);
    return { ok: false, error: "Couldn't submit. Check your connection and try again." };
  }

  if (result.ok) {
    revalidatePath("/week");
    revalidatePath("/");
    revalidatePath("/history", "layout");
  }
  return result;
}
