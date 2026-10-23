import "server-only";
import { query, queryOne, queryPaged } from "./db";
import type { Role } from "./auth";
import { addWeeks, formatDateTime, getWeekStart, weekEndsAt } from "./week";

/**
 * Admin read models. Callers must have passed requireAdmin().
 * Dynamic ORDER BY clauses come only from the hard-coded MEMBER_SORTS whitelist.
 */

// --- Activities ---------------------------------------------------------------

export type AdminActivity = {
  id: number;
  title: string;
  description: string | null;
  points: number;
  isActive: boolean;
  usedIn: number; // assessments that reference it (drafts included)
};

export async function listActivities(): Promise<AdminActivity[]> {
  const rows = await query<{
    id: number;
    title: string;
    description: string | null;
    points: number;
    is_active: number;
    used_in: number;
  }>(
    `SELECT a.id, a.title, a.description, a.points, a.is_active,
            (SELECT COUNT(*) FROM assessment_items ai WHERE ai.activity_id = a.id) AS used_in
       FROM activities a
      WHERE a.deleted_at IS NULL
      ORDER BY a.sort_order, a.id`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    points: Number(r.points),
    isActive: Number(r.is_active) === 1,
    usedIn: Number(r.used_in),
  }));
}

// --- Overview -------------------------------------------------------------------

export type TrendPoint = { weekStart: string; submissionRate: number | null; avgPercent: number | null };

export type Overview = {
  weekStart: string;
  members: number;
  submitted: number;
  submissionRate: number | null;
  avgPoints: number | null;
  avgPercent: number | null;
  top: { id: number; name: string; total: number; max: number }[];
  perActivity: { id: number; title: string; done: number; rate: number | null }[];
  trend: TrendPoint[];
  recent: AuditEntry[];
};

export type AuditEntry = {
  id: number;
  actor: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  summary: string | null;
  at: string;
};

const TREND_WEEKS = 12;

function pct(ratio: number | string | null | undefined): number | null {
  return ratio == null ? null : Math.round(Number(ratio) * 100);
}

export async function getOverview(): Promise<Overview> {
  const weekStart = getWeekStart();
  const trendFrom = addWeeks(weekStart, -(TREND_WEEKS - 1));

  const [members, thisWeek, top, perActivity, trendRows, joinedBefore, joinedRecently, recent] = await Promise.all([
    queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE is_active = 1"),
    queryOne<{ n: number; avg_points: string | null; avg_ratio: string | null }>(
      `SELECT COUNT(*) AS n, AVG(wa.total_points) AS avg_points,
              AVG(wa.total_points / NULLIF(wa.max_points, 0)) AS avg_ratio
         FROM weekly_assessments wa JOIN users u ON u.id = wa.user_id
        WHERE wa.week_start = ? AND wa.status = 'submitted' AND u.is_active = 1`,
      [weekStart],
    ),
    query<{ id: number; name: string; total_points: number; max_points: number }>(
      `SELECT u.id, u.name, wa.total_points, wa.max_points
         FROM weekly_assessments wa JOIN users u ON u.id = wa.user_id
        WHERE wa.week_start = ? AND wa.status = 'submitted' AND u.is_active = 1
        ORDER BY wa.total_points DESC, wa.submitted_at ASC
        LIMIT 5`,
      [weekStart],
    ),
    query<{ id: number; title: string; done: string | number }>(
      `SELECT a.id, a.title, COALESCE(SUM(ai.completed), 0) AS done
         FROM activities a
         LEFT JOIN (assessment_items ai
                    JOIN weekly_assessments wa ON wa.id = ai.assessment_id AND wa.week_start = ? AND wa.status = 'submitted'
                    JOIN users u ON u.id = wa.user_id AND u.is_active = 1)
                ON ai.activity_id = a.id
        WHERE a.is_active = 1 AND a.deleted_at IS NULL
        GROUP BY a.id, a.title, a.sort_order
        ORDER BY a.sort_order, a.id`,
      [weekStart],
    ),
    query<{ week_start: string; n: number; avg_ratio: string | null }>(
      `SELECT wa.week_start, COUNT(*) AS n, AVG(wa.total_points / NULLIF(wa.max_points, 0)) AS avg_ratio
         FROM weekly_assessments wa JOIN users u ON u.id = wa.user_id
        WHERE wa.status = 'submitted' AND u.is_active = 1 AND wa.week_start BETWEEN ? AND ?
        GROUP BY wa.week_start`,
      [trendFrom, weekStart],
    ),
    // Trend denominators without loading every member: one count of those who joined
    // before the window, plus join dates only for members who joined inside it.
    queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE is_active = 1 AND created_at < ?", [
      weekEndsAt(trendFrom),
    ]),
    query<{ created_at: Date }>(
      "SELECT created_at FROM users WHERE is_active = 1 AND created_at >= ? AND created_at < ?",
      [weekEndsAt(trendFrom), weekEndsAt(weekStart)],
    ),
    listAudit(8),
  ]);

  const memberCount = Number(members?.n ?? 0);
  const submitted = Number(thisWeek?.n ?? 0);

  // Submission rate per week = submitted / members who had joined by the end of that week.
  const byWeek = new Map(trendRows.map((r) => [r.week_start, r]));
  const trend: TrendPoint[] = [];
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const w = addWeeks(weekStart, -i);
    const end = weekEndsAt(w).getTime();
    const eligible =
      Number(joinedBefore?.n ?? 0) + joinedRecently.filter((j) => j.created_at.getTime() < end).length;
    const row = byWeek.get(w);
    const n = Number(row?.n ?? 0);
    trend.push({
      weekStart: w,
      submissionRate: eligible > 0 ? Math.round((n / eligible) * 100) : null,
      avgPercent: row ? pct(row.avg_ratio) : null,
    });
  }

  return {
    weekStart,
    members: memberCount,
    submitted,
    submissionRate: memberCount > 0 ? Math.round((submitted / memberCount) * 100) : null,
    avgPoints: thisWeek?.avg_points != null ? Math.round(Number(thisWeek.avg_points) * 10) / 10 : null,
    avgPercent: pct(thisWeek?.avg_ratio),
    top: top.map((t) => ({ id: t.id, name: t.name, total: Number(t.total_points), max: Number(t.max_points) })),
    perActivity: perActivity.map((a) => ({
      id: a.id,
      title: a.title,
      done: Number(a.done),
      rate: submitted > 0 ? Math.round((Number(a.done) / submitted) * 100) : null,
    })),
    trend,
    recent,
  };
}

function auditSummary(details: unknown): string | null {
  // MySQL returns JSON columns parsed; MariaDB returns them as text.
  let d = details;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const label = r.title ?? r.name ?? r.email ?? r.weekStart ?? r.from;
  const extra = r.role ?? r.to ?? null;
  return [label, extra].filter((v) => v != null && v !== "").map(String).join(" → ") || null;
}

export async function listAudit(limit: number): Promise<AuditEntry[]> {
  const rows = await queryPaged<{
    id: number;
    actor: string | null;
    action: string;
    entity: string;
    entity_id: number | null;
    details: unknown;
    created_at: Date;
  }>(
    `SELECT al.id, u.name AS actor, al.action, al.entity, al.entity_id, al.details, al.created_at
       FROM audit_log al LEFT JOIN users u ON u.id = al.actor_id
      ORDER BY al.id DESC
      LIMIT ?`,
    [Math.min(Math.max(Math.trunc(limit), 1), 200)],
  );
  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    summary: auditSummary(r.details),
    at: formatDateTime(r.created_at),
  }));
}

// --- Members --------------------------------------------------------------------

export type MemberSort = "name" | "recent" | "submitted";

const MEMBER_SORTS: Record<MemberSort, string> = {
  name: "u.name ASC, u.id ASC",
  recent: "u.created_at DESC, u.id DESC",
  submitted: "submitted DESC, u.name ASC",
};

export const MEMBERS_PAGE_SIZE = 25;

export type MemberRow = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  thisWeek: "draft" | "submitted" | null;
  submitted: number;
};

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function searchMembers(
  q: string,
  sort: MemberSort,
  page: number,
): Promise<{ members: MemberRow[]; hasNext: boolean }> {
  const offset = (page - 1) * MEMBERS_PAGE_SIZE;
  const pattern = likePattern(q);
  const rows = await queryPaged<{
    id: number;
    name: string;
    email: string;
    role: Role;
    is_active: number;
    this_week: "draft" | "submitted" | null;
    submitted: number;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.is_active,
            (SELECT wa.status FROM weekly_assessments wa WHERE wa.user_id = u.id AND wa.week_start = ?) AS this_week,
            (SELECT COUNT(*) FROM weekly_assessments wa WHERE wa.user_id = u.id AND wa.status = 'submitted') AS submitted
       FROM users u
      WHERE (? = '' OR u.name LIKE ? OR u.email LIKE ?)
      ORDER BY ${MEMBER_SORTS[sort]}
      LIMIT ? OFFSET ?`,
    [getWeekStart(), q, pattern, pattern, MEMBERS_PAGE_SIZE + 1, offset],
  );
  return {
    members: rows.slice(0, MEMBERS_PAGE_SIZE).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: Number(r.is_active) === 1,
      thisWeek: r.this_week,
      submitted: Number(r.submitted),
    })),
    hasNext: rows.length > MEMBERS_PAGE_SIZE,
  };
}

export type MemberProfile = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  joined: string;
};

export async function getMember(userId: number): Promise<MemberProfile | null> {
  const row = await queryOne<{ id: number; name: string; email: string; role: Role; is_active: number; created_at: Date }>(
    "SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?",
    [userId],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: Number(row.is_active) === 1,
    joined: formatDateTime(row.created_at),
  };
}
