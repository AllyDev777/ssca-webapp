import Link from "next/link";
import { formatWeekRange } from "@/lib/week";
import styles from "./LateWeekBanner.module.css";

/** Nudge shown while last week can still be completed late. */
export function LateWeekBanner({ weekStart, deadline }: { weekStart: string; deadline: string }) {
  return (
    <Link href={`/week?week=${weekStart}`} className={`card glass-interactive ${styles.banner}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.title}>Last week is still open</span>
        <span className={`${styles.sub} num`}>
          {formatWeekRange(weekStart)} · submit by {deadline}
        </span>
      </span>
      <span className={styles.cta}>Finish ›</span>
    </Link>
  );
}
