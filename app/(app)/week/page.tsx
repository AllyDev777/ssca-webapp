import type { Metadata } from "next";
import Link from "next/link";
import { LargeTitle } from "@/components/LargeTitle";
import { LateWeekBanner } from "@/components/LateWeekBanner";
import { getOpenLateWeek, loadWeek } from "@/lib/assessments";
import { requireUser } from "@/lib/auth";
import { formatWeekRange, getWeekStart, openLateWeek } from "@/lib/week";
import styles from "../history/history.module.css";
import { WeekChecklist } from "./WeekChecklist";

export const metadata: Metadata = { title: "This Week" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function WeekPage({ searchParams }: Props) {
  const user = await requireUser();
  const current = getWeekStart();

  // ?week= may only select last week while it's in the late-submission window;
  // anything else falls back to this week. (The actions re-check this on the server.)
  const requested = (await searchParams).week;
  const late = openLateWeek();
  const weekStart = typeof requested === "string" && requested === late ? late : current;
  const isLate = weekStart !== current;

  const [week, lateWeek] = await Promise.all([
    loadWeek(user.id, weekStart),
    isLate ? Promise.resolve(null) : getOpenLateWeek(user.id),
  ]);

  return (
    <main className="page">
      {isLate && (
        <Link href="/week" className={styles.back}>
          ‹ This week
        </Link>
      )}
      <LargeTitle title={isLate ? "Last Week" : "This Week"} subtitle={formatWeekRange(weekStart)} />
      {lateWeek && <LateWeekBanner weekStart={lateWeek.weekStart} deadline={lateWeek.deadline} />}
      {/* After submit, revalidation re-renders this with editable=false (read-only). */}
      <WeekChecklist
        key={weekStart}
        weekStart={weekStart}
        items={week.items}
        editable={week.editable}
        submittedAt={week.submittedAt}
        label={isLate ? "last week" : "this week"}
      />
    </main>
  );
}
