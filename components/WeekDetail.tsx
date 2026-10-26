import type { WeekView } from "@/lib/assessments";
import { groupBy } from "@/lib/groups";
import { getWeekStart } from "@/lib/week";
import { ChecklistRow } from "./ChecklistRow";
import { EmptyState } from "./EmptyState";
import { ProgressRing } from "./ProgressRing";
import rowStyles from "./ChecklistRow.module.css";
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

      {groupBy(week.items).map((group) => {
        const groupDone = group.items.filter((i) => i.completed).length;
        const headingId = `group-${group.key}`;
        return (
          <section key={group.key} className={styles.group} aria-labelledby={headingId}>
            <h2 id={headingId} className={styles.groupTitle}>
              {group.name}
              <span className={`${styles.groupCount} num`}>
                {groupDone}/{group.items.length}
              </span>
            </h2>
            <ul className={`card ${styles.list}`}>
              {group.items.map((item) => (
                <ChecklistRow
                  key={item.activityId}
                  id={item.activityId}
                  title={item.title}
                  description={item.description}
                  points={item.points}
                  checked={item.completed}
                  disabled
                >
                  {item.completed && item.note && (
                    <div className={rowStyles.extra}>
                      <p className={rowStyles.noteText}>{item.note}</p>
                    </div>
                  )}
                </ChecklistRow>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
