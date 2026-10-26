import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { getPool, query } from "@/lib/db";
import { hitMutationLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { exportQuerySchema } from "@/lib/validation";
import { addWeeks, weekEndsAt, weekStartOfDate, weeksBetween } from "@/lib/week";

/**
 * GET /api/admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * One CSV row per member per week (dates snap to their IST Monday). Streams week
 * by week so memory stays flat for large ranges. Read-only, so no Origin check needed.
 */

export const dynamic = "force-dynamic";

const MAX_WEEKS = 104;
const IST_OFFSET_MS = 330 * 60_000;

const HEADER = [
  "Week start",
  "Week end",
  "Name",
  "Email",
  "Status",
  "Points",
  "Max points",
  "Percent",
  "Submitted at (IST)",
  "Completed activities",
  "Notes",
];

/** Quotes every cell; neutralises spreadsheet formulas (= + - @, tab, CR) with a leading apostrophe. */
function csvCell(value: string | number | null): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(cells: (string | number | null)[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

function istTimestamp(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

type ExportRow = {
  name: string;
  email: string;
  status: "draft" | "submitted" | null;
  total_points: number | null;
  max_points: number | null;
  submitted_at: Date | null;
  completed: string | null;
  notes: string | null;
};

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof Response) return admin;

  const parsed = exportQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Use ?from=YYYY-MM-DD&to=YYYY-MM-DD" }, { status: 400 });
  }
  const from = weekStartOfDate(parsed.data.from);
  const to = weekStartOfDate(parsed.data.to);
  const span = weeksBetween(from, to);
  if (span < 0) return Response.json({ error: "'from' must be on or before 'to'." }, { status: 400 });
  if (span >= MAX_WEEKS) return Response.json({ error: `At most ${MAX_WEEKS} weeks per export.` }, { status: 400 });

  try {
    if (!(await hitMutationLimit(admin.id)).ok) {
      return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    }
    const { ip } = await getRequestMeta();
    await audit(getPool(), { actorId: admin.id, action: "export.csv", entity: "export", entityId: null, details: { from, to }, ip });
  } catch (err) {
    console.error("[export] setup failed:", err);
    return Response.json({ error: "Export failed. Please try again." }, { status: 500 });
  }

  const weeks = Array.from({ length: span + 1 }, (_, i) => addWeeks(from, i));
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`﻿${csvLine(HEADER)}`)); // BOM: Excel opens UTF-8 correctly
    },
    async pull(controller) {
      const weekStart = weeks[index++];
      if (!weekStart) {
        controller.close();
        return;
      }
      try {
        // Members with a row that week, plus active members who had joined by its end (shown as not started).
        const rows = await query<ExportRow>(
          `SELECT u.name, u.email, wa.status, wa.total_points, wa.max_points, wa.submitted_at,
                  (SELECT GROUP_CONCAT(ai.activity_title ORDER BY ai.activity_id SEPARATOR '; ')
                     FROM assessment_items ai JOIN activities a ON a.id = ai.activity_id
                    WHERE ai.assessment_id = wa.id AND ai.completed = 1
                      -- drafts, like their totals, only count currently offered activities
                      AND (wa.status = 'submitted' OR (a.is_active = 1 AND a.deleted_at IS NULL))) AS completed,
                  (SELECT GROUP_CONCAT(CONCAT(ai.activity_title, ': ', REPLACE(REPLACE(ai.note, '\r', ''), '\n', ' '))
                                       ORDER BY ai.activity_id SEPARATOR ' | ')
                     FROM assessment_items ai JOIN activities a ON a.id = ai.activity_id
                    WHERE ai.assessment_id = wa.id AND ai.completed = 1 AND ai.note IS NOT NULL AND ai.note <> ''
                      AND (wa.status = 'submitted' OR (a.is_active = 1 AND a.deleted_at IS NULL))) AS notes
             FROM users u
             LEFT JOIN weekly_assessments wa ON wa.user_id = u.id AND wa.week_start = ?
            WHERE wa.id IS NOT NULL OR (u.is_active = 1 AND u.created_at < ?)
            ORDER BY u.name, u.id`,
          [weekStart, weekEndsAt(weekStart)],
        );
        const weekEnd = addWeeks(weekStart, 1);
        const sunday = new Date(Date.parse(`${weekEnd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
        let chunk = "";
        for (const r of rows) {
          const total = r.total_points == null ? 0 : Number(r.total_points);
          const max = r.max_points == null ? null : Number(r.max_points);
          chunk += csvLine([
            weekStart,
            sunday,
            r.name,
            r.email,
            r.status === "submitted" ? "submitted" : r.status === "draft" ? "not submitted (draft)" : "not started",
            total,
            max,
            max ? Math.round((total / max) * 100) : null,
            r.submitted_at ? istTimestamp(r.submitted_at) : null,
            r.completed,
            r.notes,
          ]);
        }
        controller.enqueue(encoder.encode(chunk));
      } catch (err) {
        console.error("[export] query failed:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ssca-weeks-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
