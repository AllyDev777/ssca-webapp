import "server-only";
import { query, queryOne } from "./db";
import { addWeeks, formatDateTime, getWeekStart, openLateWeek, weeksBetween } from "./week";

/**
 * Read-only progress data for one member. userId always comes from the session
 * (or, for admins, from a validated route param checked by requireAdmin()).
 */

export type SummaryStatus = "submitted" | "draft" | "none" | "current" | "open";

export type WeekSummary = {
  weekStart: string;
  // "current": this week, not yet submitted · "open": last week, still in the late-submission window
  status: SummaryStatus;
  total: number;
  max: number | null; // null when the member never opened that week
  percent: number | null;
  submittedAt: string | null;
};

export type MemberStats = {
  streak: number;
  submittedCount: number;
  avgPoints: number | null;
  avgPercent: number | null;
};

/** Upper bound on how far back "All" goes (10 years of weeks). */
const MAX_WEEKS = 520;

type SummaryRow = {
  week_start: string;
  status: "draft" | "submitted";
  total_points: number;
  max_points: number;
  submitted_at: Date | null;
};

function percentOf(total: number, max: number): number | null {
  return max > 0 ? Math.round((total / max) * 100) : null;
}

/**
 * One summary per week from `fromWeek` to `toWeek` (inclusive), newest first.
 * Weeks with no row are filled in as "none" (0 points), so gaps are visible.
 */
export async function getWeekSummaries(userId: number, fromWeek: string, toWeek: string): Promise<WeekSummary[]> {
  const span = weeksBetween(fromWeek, toWeek);
  if (span < 0) return [];

  const rows = await query<SummaryRow>(
    `SELECT week_start, status, total_points, max_points, submitted_at
       FROM weekly_assessments
      WHERE user_id = ? AND week_start BETWEEN ? AND ?`,
    [userId, fromWeek, toWeek],
  );
  const byWeek = new Map(rows.map((r) => [r.week_start, r]));
  const current = getWeekStart();
  const late = openLateWeek();
  const unsubmitted = (weekStart: string, fallback: SummaryStatus): SummaryStatus =>
    weekStart === current ? "current" : weekStart === late ? "open" : fallback;

  const out: WeekSummary[] = [];
  for (let i = 0; i <= Math.min(span, MAX_WEEKS); i++) {
    const weekStart = addWeeks(toWeek, -i);
    const row = byWeek.get(weekStart);
    if (!row) {
      out.push({ weekStart, status: unsubmitted(weekStart, "none"), total: 0, max: null, percent: null, submittedAt: null });
      continue;
    }
    const total = Number(row.total_points);
    const max = Number(row.max_points);
    const status: SummaryStatus = row.status === "submitted" ? "submitted" : unsubmitted(weekStart, "draft");
    out.push({
      weekStart,
      status,
      total,
      max,
      percent: percentOf(total, max),
      submittedAt: row.submitted_at ? formatDateTime(row.submitted_at) : null,
    });
  }
  return out;
}

/** Monday of the member's first week: when they joined, or their earliest assessment if older. */
export async function getMemberFirstWeek(userId: number): Promise<string | null> {
  const row = await queryOne<{ created_at: Date; first_week: string | null }>(
    `SELECT u.created_at,
            (SELECT MIN(week_start) FROM weekly_assessments WHERE user_id = u.id) AS first_week
       FROM users u WHERE u.id = ?`,
    [userId],
  );
  if (!row) return null;
  const joined = getWeekStart(row.created_at);
  return row.first_week && row.first_week < joined ? row.first_week : joined;
}

/**
 * Streak = consecutive submitted weeks ending with this week, or with last week
 * while this week is still open (so the streak doesn't "break" on Monday morning).
 * Likewise, an unsubmitted last week that can still be submitted late doesn't break it yet.
 */
function computeStreak(submittedDesc: string[], current: string): number {
  let expected = submittedDesc[0] === current ? current : addWeeks(current, -1);
  if (expected !== current && submittedDesc[0] !== expected && expected === openLateWeek()) {
    expected = addWeeks(expected, -1);
  }
  let streak = 0;
  for (const week of submittedDesc) {
    if (week > expected) continue;
    if (week !== expected) break;
    streak++;
    expected = addWeeks(expected, -1);
  }
  return streak;
}

export async function getMemberStats(userId: number): Promise<MemberStats> {
  const current = getWeekStart();
  const [weeks, agg] = await Promise.all([
    query<{ week_start: string }>(
      `SELECT week_start FROM weekly_assessments
        WHERE user_id = ? AND status = 'submitted' AND week_start <= ?
        ORDER BY week_start DESC LIMIT 520`, // 520 = MAX_WEEKS
      [userId, current],
    ),
    queryOne<{ n: number; avg_points: string | null; avg_ratio: string | null }>(
      `SELECT COUNT(*) AS n,
              AVG(total_points) AS avg_points,
              AVG(total_points / NULLIF(max_points, 0)) AS avg_ratio
         FROM weekly_assessments
        WHERE user_id = ? AND status = 'submitted'`,
      [userId],
    ),
  ]);

  return {
    streak: computeStreak(weeks.map((w) => w.week_start), current),
    submittedCount: Number(agg?.n ?? 0),
    avgPoints: agg?.avg_points != null ? Math.round(Number(agg.avg_points) * 10) / 10 : null,
    avgPercent: agg?.avg_ratio != null ? Math.round(Number(agg.avg_ratio) * 100) : null,
  };
}

export const HISTORY_RANGES = { "4w": 4, "12w": 12, all: MAX_WEEKS } as const;
export type HistoryRange = keyof typeof HISTORY_RANGES;

export function parseHistoryRange(value: string | string[] | undefined): HistoryRange {
  return value === "4w" || value === "all" ? value : "12w";
}

/** The member's history list: this week plus past weeks back to when they joined. */
export async function getHistory(userId: number, range: HistoryRange): Promise<WeekSummary[]> {
  const firstWeek = await getMemberFirstWeek(userId);
  if (!firstWeek) return [];
  const current = getWeekStart();
  const earliest = addWeeks(current, -(HISTORY_RANGES[range] - 1));
  return getWeekSummaries(userId, firstWeek > earliest ? firstWeek : earliest, current);
}
