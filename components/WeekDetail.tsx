import type { WeekView } from "@/lib/assessments";
import { getWeekStart } from "@/lib/week";
import { ChecklistRow } from "./ChecklistRow";
import { EmptyState } from "./EmptyState";
import { ProgressRing } from "./ProgressRing";
import styles from "./WeekDetail.module.css";

/** Read-only view of one past week (member history and admin member view). */
export function WeekDetail({ week }: { week: WeekView }) {
  if (week.status === "none") {
    return (
      <EmptyState title="Not submitted">
        <p>Nothing was recorded for this week, so it counts as 0 points.</p>
      </EmptyState>
    );
  }

  const done = week.items.filter((i) => i.completed).length;
  const submitted = week.status === "submitted";
  const inProgress = !submitted && week.weekStart === getWeekStart();

  return (
    <>
      <section className={`card glass-strong ${styles.summary}`} aria-label="Week result">
        <ProgressRing value={week.total} max={week.max} size={112} />
        <div className={styles.text}>
          <p className={`${styles.score} num`}>
            {week.total} / {week.max} pts
          </p>
          <p className={`${styles.meta} num`}>
            {done} of {week.items.length} activities done
          </p>
          <p className={styles.status} data-state={submitted ? "submitted" : "missed"}>
            {submitted
              ? `Submitted ${week.submittedAt ?? ""}`
              : inProgress
                ? "In progress · not yet submitted"
                : "Not submitted · draft score"}
          </p>
        </div>
      </section>

      <ul className={`card ${styles.list}`} aria-label="Activities">
        {week.items.map((item) => (
          <ChecklistRow
            key={item.activityId}
            id={item.activityId}
            title={item.title}
            description={item.description}
            points={item.points}
            checked={item.completed}
            disabled
          />
        ))}
      </ul>
    </>
  );
}
