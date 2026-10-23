import Link from "next/link";
import { logout } from "@/actions/auth";
import { BarChart } from "@/components/BarChart";
import { LargeTitle } from "@/components/LargeTitle";
import { ProgressRing } from "@/components/ProgressRing";
import { StatGrid, StatTile } from "@/components/StatTile";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LateWeekBanner } from "@/components/LateWeekBanner";
import { getOpenLateWeek, loadWeek } from "@/lib/assessments";
import { requireUser } from "@/lib/auth";
import { summariesToBars } from "@/lib/chart";
import { getMemberStats, getWeekSummaries } from "@/lib/history";
import { getThemePref } from "@/lib/theme-server";
import { addWeeks, formatWeekRange, getWeekStart } from "@/lib/week";
import styles from "./dashboard.module.css";

const CHART_WEEKS = 12;

export default async function Dashboard() {
  const user = await requireUser();
  const current = getWeekStart();

  // All in parallel. The chart's bar for this week is taken from `week` (which may
  // have just been created/synced) rather than from the concurrent summary query.
  const [week, stats, summaries, theme, lateWeek] = await Promise.all([
    loadWeek(user.id, current),
    getMemberStats(user.id),
    getWeekSummaries(user.id, addWeeks(current, -(CHART_WEEKS - 1)), current),
    getThemePref(),
    getOpenLateWeek(user.id),
  ]);
  const recent = summaries.map((w) =>
    w.weekStart === current
      ? {
          ...w,
          status: week.status === "submitted" ? ("submitted" as const) : ("current" as const),
          total: week.total,
          max: week.max,
          percent: week.max > 0 ? Math.round((week.total / week.max) * 100) : null,
        }
      : w,
  );

  const done = week.items.filter((i) => i.completed).length;
  const pending = week.items.length - done;
  const submitted = week.status === "submitted";
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <main className="page">
      <LargeTitle title="Home" subtitle={`Peace be with you, ${firstName}`} />
      {lateWeek && <LateWeekBanner weekStart={lateWeek.weekStart} deadline={lateWeek.deadline} />}

      <Link href="/week" className={`card glass-strong glass-interactive ${styles.hero}`}>
        <ProgressRing value={week.total} max={week.max} size={112} />
        <span className={styles.heroText}>
          <span className={styles.heroLabel}>This week</span>
          <span className={`${styles.heroRange} num`}>{formatWeekRange(current)}</span>
          <span className={styles.heroStatus} data-state={submitted ? "submitted" : "draft"}>
            {submitted ? "Submitted" : pending === 0 && week.items.length > 0 ? "Ready to submit" : "In progress"}
          </span>
          <span className={styles.heroCta}>{submitted ? "View week" : "Open checklist"} ›</span>
        </span>
      </Link>

      <StatGrid label="This week at a glance">
        <StatTile label="Completed" value={done} tone="leaf" />
        <StatTile label="Pending" value={pending} tone="coral" />
        <StatTile label="Points" value={week.total} unit={`/ ${week.max}`} tone="teal" />
        <StatTile label="Streak" value={stats.streak} unit={stats.streak === 1 ? "week" : "weeks"} tone="sun" />
      </StatGrid>

      <section className={`card ${styles.chartCard}`} aria-labelledby="progress-heading">
        <div className={styles.chartHead}>
          <h2 id="progress-heading" className={styles.h2}>
            Last {CHART_WEEKS} weeks
          </h2>
          <p className={`${styles.avg} num`}>
            {stats.avgPercent !== null
              ? `Average ${stats.avgPoints} pts · ${stats.avgPercent}%`
              : "No submitted weeks yet"}
          </p>
        </div>
        <BarChart bars={summariesToBars(recent)} caption={`Your score for each of the last ${CHART_WEEKS} weeks`} />
        {stats.submittedCount === 0 && (
          <p className={styles.chartHint}>Submit your first week to start your progress chart.</p>
        )}
      </section>

      <p className={styles.historyLink}>
        <Link href="/history">See all past weeks ›</Link>
      </p>

      {/* The sidebar has these on desktop; phones get them here. */}
      <section className={`card ${styles.settings}`} aria-labelledby="settings-h">
        <Link href="/account" className={styles.accountLink}>
          <span>Account &amp; password</span>
          <span aria-hidden="true">›</span>
        </Link>
        <h2 id="settings-h" className={styles.settingsTitle}>
          Appearance
        </h2>
        <ThemeSwitcher initial={theme} />
        <form action={logout}>
          <button type="submit" className={styles.signOut}>
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
