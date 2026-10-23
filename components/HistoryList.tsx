import Link from "next/link";
import type { WeekSummary } from "@/lib/history";
import { formatWeekRange } from "@/lib/week";
import styles from "./HistoryList.module.css";

const STATUS_TEXT: Record<WeekSummary["status"], string> = {
  submitted: "Submitted",
  current: "In progress",
  open: "Still open · finish it today",
  draft: "Not submitted",
  none: "Not submitted",
};

/** Grouped list of weeks. `hrefFor` decides where each row links (member vs admin view). */
export function HistoryList({ weeks, hrefFor }: { weeks: WeekSummary[]; hrefFor: (w: WeekSummary) => string }) {
  return (
    <ul className={`card ${styles.list}`}>
      {weeks.map((w) => (
        <li key={w.weekStart} className={styles.item}>
          <Link href={hrefFor(w)} className={styles.row}>
            <span className={styles.text}>
              <span className={`${styles.range} num`}>{formatWeekRange(w.weekStart)}</span>
              <span className={styles.status} data-status={w.status}>
                {w.status === "submitted" && w.submittedAt ? `Submitted ${w.submittedAt}` : STATUS_TEXT[w.status]}
              </span>
            </span>
            <span className={`${styles.score} num`}>
              {w.total}
              {w.max !== null && <span className={styles.max}> / {w.max}</span>}
            </span>
            <span className={`${styles.pill} num`} data-status={w.status}>
              {w.percent !== null ? `${w.percent}%` : "—"}
            </span>
            <svg className={styles.chevron} viewBox="0 0 8 14" width={8} height={14} aria-hidden="true">
              <path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
