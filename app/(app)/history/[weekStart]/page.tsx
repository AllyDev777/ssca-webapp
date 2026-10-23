import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LargeTitle } from "@/components/LargeTitle";
import { WeekDetail } from "@/components/WeekDetail";
import { loadWeek } from "@/lib/assessments";
import { requireUser } from "@/lib/auth";
import { formatShortDate, formatWeekRange, getWeekStart, isWeekStart, openLateWeek } from "@/lib/week";
import styles from "../history.module.css";

type Props = { params: Promise<{ weekStart: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { weekStart } = await params;
  return { title: isWeekStart(weekStart) ? `Week of ${formatShortDate(weekStart)}` : "Week" };
}

export default async function WeekHistoryPage({ params }: Props) {
  const user = await requireUser();
  const { weekStart } = await params;
  if (!isWeekStart(weekStart)) notFound();

  const current = getWeekStart();
  if (weekStart > current) notFound();
  if (weekStart === current) redirect("/week");
  // Last week during the late-submission window is still editable, so open it in the checklist.
  if (weekStart === openLateWeek()) redirect(`/week?week=${weekStart}`);

  // Always the signed-in member's own week: the URL only chooses *which* week.
  const week = await loadWeek(user.id, weekStart);

  return (
    <main className="page">
      <Link href="/history" className={styles.back}>
        ‹ History
      </Link>
      <LargeTitle title={`Week of ${formatShortDate(weekStart)}`} subtitle={formatWeekRange(weekStart)} />
      <WeekDetail week={week} />
    </main>
  );
}
