import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { LargeTitle } from "@/components/LargeTitle";
import { LineChart } from "@/components/LineChart";
import { StatGrid, StatTile } from "@/components/StatTile";
import { getOverview } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { addWeeks, formatShortDate, formatWeekRange } from "@/lib/week";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Admin" };

const ACTION_LABELS: Record<string, string> = {
  "activity.create": "added activity",
  "activity.update": "edited activity",
  "activity.activate": "activated",
  "activity.deactivate": "deactivated",
  "activity.reorder": "reordered",
  "activity.delete": "deleted activity",
  "activity.soft_delete": "removed activity",
  "user.role_change": "changed role",
  "user.activate": "reactivated",
  "user.deactivate": "deactivated",
  "week.reopen": "reopened week",
  "export.csv": "exported CSV",
  "account.password_change": "changed their password",
  "user.create_admin_cli": "created admin (CLI)",
  "user.promote_admin_cli": "promoted admin (CLI)",
};

export default async function AdminOverview() {
  await requireAdmin();
  const o = await getOverview();

  return (
    <main className="page">
      <LargeTitle title="Admin" subtitle={`This week · ${formatWeekRange(o.weekStart)}`} />
      <AdminNav current="overview" />

      <StatGrid label="This week">
        <StatTile label="Members" value={o.members} tone="teal" />
        <StatTile label="Submitted" value={o.submitted} unit={`/ ${o.members}`} tone="leaf" />
        <StatTile label="Rate" value={o.submissionRate ?? "—"} unit={o.submissionRate !== null ? "%" : undefined} tone="sun" />
        <StatTile
          label="Avg score"
          value={o.avgPoints ?? "—"}
          unit={o.avgPercent !== null ? `pts · ${o.avgPercent}%` : undefined}
          tone="coral"
        />
      </StatGrid>

      <section className={styles.section} aria-labelledby="top-h">
        <div className={styles.sectionHead}>
          <h2 id="top-h" className={styles.h2}>Top members this week</h2>
        </div>
        <ol className={`card ${styles.list}`}>
          {o.top.length === 0 ? (
            <li className={styles.empty}>No submissions yet this week.</li>
          ) : (
            o.top.map((m, i) => (
              <li key={m.id}>
                <Link href={`/admin/members/${m.id}`} className={styles.row}>
                  <span className={`${styles.rank} num`}>{i + 1}</span>
                  <span className={styles.grow}>
                    <span className={styles.title}>{m.name}</span>
                  </span>
                  <span className={`${styles.value} num`}>
                    {m.total}
                    <span className={styles.muted}> / {m.max}</span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="act-h">
        <div className={styles.sectionHead}>
          <h2 id="act-h" className={styles.h2}>Completion by activity</h2>
          <span className={styles.headNote}>of submitted weeks</span>
        </div>
        <ul className={`card ${styles.list}`}>
          {o.perActivity.map((a) => (
            <li key={a.id} className={styles.row}>
              <span className={styles.grow}>
                <span className={styles.title}>{a.title}</span>
                <span className={styles.meter} aria-hidden="true">
                  <span className={styles.meterFill} style={{ transform: `scaleX(${(a.rate ?? 0) / 100})` }} />
                </span>
              </span>
              <span className={`${styles.value} num`}>{a.rate !== null ? `${a.rate}%` : "—"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="trend-h">
        <div className={styles.sectionHead}>
          <h2 id="trend-h" className={styles.h2}>Last 12 weeks</h2>
        </div>
        <div className={`card ${styles.padded}`}>
          <LineChart
            labels={o.trend.map((t) => formatShortDate(t.weekStart))}
            series={[
              { name: "Submission rate", tone: "teal", values: o.trend.map((t) => t.submissionRate) },
              { name: "Average score", tone: "sun", values: o.trend.map((t) => t.avgPercent) },
            ]}
            caption="Weekly submission rate and average score, last 12 weeks"
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="export-h">
        <div className={styles.sectionHead}>
          <h2 id="export-h" className={styles.h2}>Export CSV</h2>
          <span className={styles.headNote}>dates snap to their week</span>
        </div>
        {/* Plain GET form: the browser downloads the streamed file. */}
        <form action={withBase("/api/admin/export")} method="get" className={`card ${styles.padded} ${styles.inlineForm}`}>
          <div className={styles.inlineField}>
            <label htmlFor="export-from">From</label>
            <input id="export-from" name="from" type="date" required className={styles.input} defaultValue={addWeeks(o.weekStart, -3)} />
          </div>
          <div className={styles.inlineField}>
            <label htmlFor="export-to">To</label>
            <input id="export-to" name="to" type="date" required className={styles.input} defaultValue={o.weekStart} />
          </div>
          <button type="submit" className={styles.button}>
            Download
          </button>
        </form>
      </section>

      <section className={styles.section} aria-labelledby="audit-h">
        <div className={styles.sectionHead}>
          <h2 id="audit-h" className={styles.h2}>Recent admin activity</h2>
        </div>
        <ul className={`card ${styles.list}`}>
          {o.recent.length === 0 ? (
            <li className={styles.empty}>Nothing yet.</li>
          ) : (
            o.recent.map((e) => (
              <li key={e.id} className={styles.row}>
                <span className={styles.grow}>
                  <span>
                    <strong>{e.actor ?? "System"}</strong> {ACTION_LABELS[e.action] ?? e.action}
                    {e.summary ? ` · ${e.summary}` : ""}
                  </span>
                  <span className={styles.sub}>{e.at}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
