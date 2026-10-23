import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LargeTitle } from "@/components/LargeTitle";
import { WeekDetail } from "@/components/WeekDetail";
import { getMember } from "@/lib/admin";
import { loadWeek } from "@/lib/assessments";
import { requireAdmin } from "@/lib/auth";
import { memberIdParam } from "@/lib/validation";
import { formatShortDate, formatWeekRange, getWeekStart, isWeekEditable, isWeekStart } from "@/lib/week";
import styles from "../../../admin.module.css";
import { ReopenWeek } from "./ReopenWeek";

export const metadata: Metadata = { title: "Member week" };

type Props = { params: Promise<{ id: string; weekStart: string }> };

export default async function MemberWeekPage({ params }: Props) {
  await requireAdmin();
  const { id, weekStart } = await params;
  const parsedId = memberIdParam.safeParse(id);
  if (!parsedId.success || !isWeekStart(weekStart) || weekStart > getWeekStart()) notFound();
  const member = await getMember(parsedId.data);
  if (!member) notFound();

  // readOnly: viewing must never create or change the member's data.
  const week = await loadWeek(member.id, weekStart, { readOnly: true });
  const canReopen = week.status === "submitted" && isWeekEditable(weekStart);

  return (
    <main className="page">
      <Link href={`/admin/members/${member.id}`} className={styles.backLink}>
        ‹ {member.name}
      </Link>
      <LargeTitle title={`Week of ${formatShortDate(weekStart)}`} subtitle={`${member.name} · ${formatWeekRange(weekStart)}`} />
      <WeekDetail week={week} />
      {canReopen && <ReopenWeek userId={member.id} weekStart={weekStart} />}
    </main>
  );
}
