import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { HistoryList } from "@/components/HistoryList";
import { LargeTitle } from "@/components/LargeTitle";
import { Segmented } from "@/components/Segmented";
import { requireUser } from "@/lib/auth";
import { getHistory, parseHistoryRange } from "@/lib/history";
import styles from "./history.module.css";

export const metadata: Metadata = { title: "History" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const RANGE_OPTIONS = [
  { value: "4w", label: "4W", href: "/history?range=4w" },
  { value: "12w", label: "12W", href: "/history" },
  { value: "all", label: "All", href: "/history?range=all" },
];

export default async function HistoryPage({ searchParams }: Props) {
  const user = await requireUser();
  const range = parseHistoryRange((await searchParams).range);
  const weeks = await getHistory(user.id, range);
  const submitted = weeks.filter((w) => w.status === "submitted").length;

  return (
    <main className="page">
      <LargeTitle title="History" />
      <div className={styles.controls}>
        <Segmented options={RANGE_OPTIONS} value={range} label="Time range" />
        {weeks.length > 0 && (
          <p className={`${styles.count} num`}>
            {submitted} of {weeks.length} weeks submitted
          </p>
        )}
      </div>

      {weeks.length === 0 ? (
        <EmptyState title="No weeks yet">
          <p>
            Your weekly results will appear here. <Link href="/week">Start this week</Link>
          </p>
        </EmptyState>
      ) : (
        <HistoryList
          weeks={weeks}
          hrefFor={(w) =>
            w.status === "current" ? "/week" : w.status === "open" ? `/week?week=${w.weekStart}` : `/history/${w.weekStart}`
          }
        />
      )}
    </main>
  );
}
