"use server";

import type { PoolConnection } from "mysql2/promise";
import { revalidatePath } from "next/cache";
import { recomputeTotals } from "@/lib/assessments";
import { audit } from "@/lib/audit";
import { requireAdmin, type SessionUser } from "@/lib/auth";
import { execute, query, queryOne, transaction } from "@/lib/db";
import { hitMutationLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import {
  activityActiveSchema,
  activityFormSchema,
  activityIdSchema,
  activityMoveSchema,
  fieldErrors,
  formFields,
  memberActiveSchema,
  memberRoleSchema,
  reopenWeekSchema,
} from "@/lib/validation";
import { isWeekEditable } from "@/lib/week";

/**
 * Admin mutations. Every action: requireAdmin() first, then rate limit, zod
 * validation, and a transaction that writes the change *and* its audit entry.
 */

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

const INVALID: AdminResult = { ok: false, error: "Invalid request." };
const NOT_FOUND: AdminResult = { ok: false, error: "That item no longer exists. Please refresh." };

async function run(admin: SessionUser, label: string, fn: (ip: string | null) => Promise<AdminResult>): Promise<AdminResult> {
  try {
    if (!(await hitMutationLimit(admin.id)).ok) {
      return { ok: false, error: "You're going a little fast — please wait a moment." };
    }
    const { ip } = await getRequestMeta();
    const result = await fn(ip);
    // Activities and roles affect most pages (checklists, dashboards, tab bar).
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    console.error(`[admin] ${label} failed:`, err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// --- Activities ------------------------------------------------------------------

export type ActivityFormState = { savedAt?: number; error?: string; fieldErrors?: Record<string, string> };

/** Create (no id) or edit (id) from the activity form. Points changes affect current/future weeks only. */
export async function saveActivity(_prev: ActivityFormState, formData: FormData): Promise<ActivityFormState> {
  const admin = await requireAdmin();
  const parsed = activityFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { id, title, description, points, groupId, allowsNote } = parsed.data;

  const result = await run(admin, "saveActivity", (ip) =>
    transaction(async (conn): Promise<AdminResult> => {
      let groupName: string | null = null;
      if (groupId !== null) {
        const group = await queryOne<{ name: string }>("SELECT name FROM activity_groups WHERE id = ?", [groupId], conn);
        if (!group) return { ok: false, error: "That group no longer exists. Please refresh." };
        groupName = group.name;
      }
      // New (or moved) activities go to the end of their group.
      const nextSortSql = "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM activities WHERE group_id <=> ?";
      const details = { title, points, group: groupName, allowsNote };

      if (id) {
        const before = await queryOne<{ points: number; group_id: number | null }>(
          "SELECT points, group_id FROM activities WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
          [id],
          conn,
        );
        if (!before) return NOT_FOUND;
        const moved = before.group_id !== groupId;
        const sort = moved ? (await queryOne<{ next: number }>(nextSortSql, [groupId], conn))?.next : null;
        await execute(
          `UPDATE activities SET title = ?, description = ?, points = ?, group_id = ?, allows_note = ?,
                  sort_order = COALESCE(?, sort_order)
            WHERE id = ?`,
          [title, description, points, groupId, allowsNote ? 1 : 0, sort ?? null, id],
          conn,
        );
        await audit(conn, {
          actorId: admin.id,
          action: "activity.update",
          entity: "activity",
          entityId: id,
          details: { ...details, previousPoints: Number(before.points) },
          ip,
        });
        return { ok: true };
      }
      const sort = (await queryOne<{ next: number }>(nextSortSql, [groupId], conn))?.next ?? 10;
      const inserted = await execute(
        "INSERT INTO activities (title, description, group_id, points, allows_note, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [title, description, groupId, points, allowsNote ? 1 : 0, sort],
        conn,
      );
      await audit(conn, { actorId: admin.id, action: "activity.create", entity: "activity", entityId: inserted.insertId, details, ip });
      return { ok: true };
    }),
  );
  return result.ok ? { savedAt: Date.now() } : { error: result.error };
}

export async function setActivityActive(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = activityActiveSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { id, active } = parsed.data;

  return run(admin, "setActivityActive", (ip) =>
    transaction(async (conn) => {
      const act = await queryOne<{ title: string }>("SELECT title FROM activities WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id], conn);
      if (!act) return NOT_FOUND;
      await execute("UPDATE activities SET is_active = ? WHERE id = ?", [active ? 1 : 0, id], conn);
      await audit(conn, {
        actorId: admin.id,
        action: active ? "activity.activate" : "activity.deactivate",
        entity: "activity",
        entityId: id,
        details: { title: act.title },
        ip,
      });
      return { ok: true };
    }),
  );
}

export async function moveActivity(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = activityMoveSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { id, direction } = parsed.data;

  return run(admin, "moveActivity", (ip) =>
    transaction(async (conn) => {
      // Reordering happens within the activity's own group (the checklist tab).
      const target = await queryOne<{ group_id: number | null }>(
        "SELECT group_id FROM activities WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
        [id],
        conn,
      );
      if (!target) return NOT_FOUND;
      const rows = await query<{ id: number; title: string }>(
        "SELECT id, title FROM activities WHERE deleted_at IS NULL AND group_id <=> ? ORDER BY sort_order, id FOR UPDATE",
        [target.group_id],
        conn,
      );
      const from = rows.findIndex((r) => r.id === id);
      if (from === -1) return NOT_FOUND;
      const to = direction === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= rows.length) return { ok: true };

      const order = rows.map((r) => r.id);
      [order[from], order[to]] = [order[to]!, order[from]!];
      // Renumber 10, 20, 30… so gaps never run out.
      for (const [index, activityId] of order.entries()) {
        await execute("UPDATE activities SET sort_order = ? WHERE id = ?", [(index + 1) * 10, activityId], conn);
      }
      await audit(conn, { actorId: admin.id, action: "activity.reorder", entity: "activity", entityId: id, details: { title: rows[from]!.title, to: direction }, ip });
      return { ok: true };
    }),
  );
}

/** Hard delete if never used; otherwise soft delete so history keeps its references. */
export async function deleteActivity(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = activityIdSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { id } = parsed.data;

  return run(admin, "deleteActivity", (ip) =>
    transaction(async (conn) => {
      // Locking the parent row blocks concurrent inserts of items that reference it.
      const act = await queryOne<{ title: string }>("SELECT title FROM activities WHERE id = ? AND deleted_at IS NULL FOR UPDATE", [id], conn);
      if (!act) return NOT_FOUND;
      const used = await queryOne("SELECT 1 FROM assessment_items WHERE activity_id = ? LIMIT 1", [id], conn);

      if (used) {
        await execute("UPDATE activities SET is_active = 0, deleted_at = UTC_TIMESTAMP() WHERE id = ?", [id], conn);
        await audit(conn, { actorId: admin.id, action: "activity.soft_delete", entity: "activity", entityId: id, details: { title: act.title }, ip });
        return { ok: true, message: "Removed. Past weeks still show it." };
      }
      await execute("DELETE FROM activities WHERE id = ?", [id], conn);
      await audit(conn, { actorId: admin.id, action: "activity.delete", entity: "activity", entityId: id, details: { title: act.title }, ip });
      return { ok: true, message: "Activity deleted." };
    }),
  );
}

// --- Members ---------------------------------------------------------------------

type TargetRow = { id: number; email: string; role: "member" | "admin"; is_active: number };

async function lockTarget(userId: number, conn: PoolConnection) {
  return queryOne<TargetRow>("SELECT id, email, role, is_active FROM users WHERE id = ? FOR UPDATE", [userId], conn);
}

/** Changing a role signs the member out everywhere (session rotation). */
export async function setMemberRole(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = memberRoleSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { userId, role } = parsed.data;
  // Prevents locking yourself out; another admin must do it.
  if (userId === admin.id) return { ok: false, error: "You can't change your own role." };

  return run(admin, "setMemberRole", (ip) =>
    transaction(async (conn) => {
      const target = await lockTarget(userId, conn);
      if (!target) return NOT_FOUND;
      if (target.role === role) return { ok: true };
      await execute("UPDATE users SET role = ? WHERE id = ?", [role, userId], conn);
      await execute("DELETE FROM sessions WHERE user_id = ?", [userId], conn);
      await audit(conn, { actorId: admin.id, action: "user.role_change", entity: "user", entityId: userId, details: { email: target.email, role }, ip });
      return { ok: true, message: role === "admin" ? "Now an admin." : "Now a member." };
    }),
  );
}

/** Deactivated accounts can't sign in and are signed out immediately. History is kept. */
export async function setMemberActive(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = memberActiveSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { userId, active } = parsed.data;
  if (userId === admin.id) return { ok: false, error: "You can't deactivate your own account." };

  return run(admin, "setMemberActive", (ip) =>
    transaction(async (conn) => {
      const target = await lockTarget(userId, conn);
      if (!target) return NOT_FOUND;
      await execute("UPDATE users SET is_active = ? WHERE id = ?", [active ? 1 : 0, userId], conn);
      if (!active) await execute("DELETE FROM sessions WHERE user_id = ?", [userId], conn);
      await audit(conn, {
        actorId: admin.id,
        action: active ? "user.activate" : "user.deactivate",
        entity: "user",
        entityId: userId,
        details: { email: target.email },
        ip,
      });
      return { ok: true, message: active ? "Account reactivated." : "Account deactivated." };
    }),
  );
}

/** Returns a submitted week to draft so the member can fix it (only while the week is still open). */
export async function reopenWeek(input: unknown): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = reopenWeekSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { userId, weekStart } = parsed.data;
  if (!isWeekEditable(weekStart)) {
    return { ok: false, error: "Only a week that is still open can be reopened." };
  }

  return run(admin, "reopenWeek", (ip) =>
    transaction(async (conn) => {
      const row = await queryOne<{ id: number; status: string; email: string }>(
        `SELECT wa.id, wa.status, u.email
           FROM weekly_assessments wa JOIN users u ON u.id = wa.user_id
          WHERE wa.user_id = ? AND wa.week_start = ? FOR UPDATE`,
        [userId, weekStart],
        conn,
      );
      if (!row) return NOT_FOUND;
      if (row.status !== "submitted") return { ok: false, error: "That week isn't submitted." };
      await execute("UPDATE weekly_assessments SET status = 'draft', submitted_at = NULL WHERE id = ?", [row.id], conn);
      await recomputeTotals(row.id, conn);
      await audit(conn, { actorId: admin.id, action: "week.reopen", entity: "assessment", entityId: row.id, details: { email: row.email, weekStart }, ip });
      return { ok: true, message: "Week reopened. The member can edit and resubmit it." };
    }),
  );
}
