import styles from "./PageSkeleton.module.css";

/** Calm placeholder shown while a signed-in page loads (same shapes as the real page, so no layout jump). */
export function PageSkeleton() {
  return (
    <main className="page" aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading…
      </p>
      <div className={styles.header} aria-hidden="true">
        <span className={`${styles.bone} ${styles.title}`} />
        <span className={`${styles.bone} ${styles.subtitle}`} />
      </div>
      <div className={`card ${styles.hero}`} aria-hidden="true">
        <span className={`${styles.bone} ${styles.ring}`} />
        <span className={styles.lines}>
          <span className={`${styles.bone} ${styles.line}`} />
          <span className={`${styles.bone} ${styles.lineShort}`} />
        </span>
      </div>
      <div className={`card ${styles.list}`} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={styles.row}>
            <span className={`${styles.bone} ${styles.dot}`} />
            <span className={`${styles.bone} ${styles.line}`} />
          </span>
        ))}
      </div>
    </main>
  );
}
