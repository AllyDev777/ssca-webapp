import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { HistoryList } from "@/components/HistoryList";
import { LargeTitle } from "@/components/LargeTitle";
import { Segmented } from "@/components/Segmented";
import { StatGrid, StatTile } from "@/components/StatTile";
import { getMember } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { getHistory, getMemberStats, parseHistoryRange } from "@/lib/history";
import { memberIdParam } from "@/lib/validation";
import styles from "../../admin.module.css";
import { MemberControls } from "./MemberControls";

export const metadata: Metadata = { title: "Member" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MemberPage({ params, searchParams }: Props) {
  const admin = await requireAdmin();
  const parsedId = memberIdParam.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const member = await getMember(parsedId.data);
  if (!member) notFound();

  const range = parseHistoryRange((await searchParams).range);
  const [stats, weeks] = await Promise.all([getMemberStats(member.id), getHistory(member.id, range)]);
  const base = `/admin/members/${member.id}`;

  return (
    <main className="page">
      <Link href="/admin/members" className={styles.backLink}>
        ‹ Members
      </Link>
      <LargeTitle title={member.name} subtitle={member.email} />

      <section className={`card ${styles.padded}`} aria-label="Account">
        <p className={styles.sub}>Joined {member.joined}</p>
        <MemberControls
          userId={member.id}
          role={member.role}
          isActive={member.isActive}
          isSelf={member.id === admin.id}
        />
      </section>

      <div className={styles.section}>
        <StatGrid label="Member stats">
          <StatTile label="Streak" value={stats.streak} unit={stats.streak === 1 ? "week" : "weeks"} tone="sun" />
          <StatTile label="Submitted" value={stats.submittedCount} unit="weeks" tone="leaf" />
          <StatTile label="Avg points" value={stats.avgPoints ?? "—"} tone="teal" />
          <StatTile label="Avg score" value={stats.avgPercent ?? "—"} unit={stats.avgPercent !== null ? "%" : undefined} tone="coral" />
        </StatGrid>
      </div>

      <section className={styles.section} aria-labelledby="hist-h">
        <div className={styles.sectionHead}>
          <h2 id="hist-h" className={styles.h2}>History (read-only)</h2>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Segmented
            label="Time range"
            value={range}
            options={[
              { value: "4w", label: "4W", href: `${base}?range=4w` },
              { value: "12w", label: "12W", href: base },
              { value: "all", label: "All", href: `${base}?range=all` },
            ]}
          />
        </div>
        {weeks.length === 0 ? (
          <EmptyState title="No weeks yet" />
        ) : (
          <HistoryList weeks={weeks} hrefFor={(w) => `${base}/${w.weekStart}`} />
        )}
      </section>
    </main>
  );
}
