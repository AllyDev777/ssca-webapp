import styles from "./PageSkeleton.module.css";

type Props = {
  /** Small "‹ Back" link above the title (detail pages). */
  back?: boolean;
  /** Segmented control under the title (History ranges, admin sections). */
  segmented?: boolean;
  /** Progress-ring summary card (Home, This Week, week detail). */
  hero?: boolean;
  /** 2×2 stat tiles (Home, admin overview). */
  tiles?: boolean;
  /** Rows in the grouped list card; 0 hides it. */
  rows?: number;
  /** Leading circle on each row (checklists). */
  dots?: boolean;
};

/**
 * Calm placeholder shown the moment a page is tapped, in the same shapes as the real
 * page so nothing jumps when the data arrives. Server Component, no JavaScript.
 */
export function PageSkeleton({ back, segmented, hero, tiles, rows = 4, dots }: Props) {
  return (
    <main className="page" aria-busy="true">
      <p className="visually-hidden" role="status">
        Loading…
      </p>
      <div aria-hidden="true">
        {back && <span className={`${styles.bone} ${styles.back}`} />}
        <div className={styles.header}>
          <span className={`${styles.bone} ${styles.title}`} />
          <span className={`${styles.bone} ${styles.subtitle}`} />
        </div>
        {segmented && <span className={`${styles.bone} ${styles.segmented}`} />}
        {hero && (
          <div className={`card ${styles.hero}`}>
            <span className={`${styles.bone} ${styles.ring}`} />
            <span className={styles.lines}>
              <span className={`${styles.bone} ${styles.line}`} />
              <span className={`${styles.bone} ${styles.lineShort}`} />
            </span>
          </div>
        )}
        {tiles && (
          <div className={styles.tiles}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`card ${styles.tile}`}>
                <span className={`${styles.bone} ${styles.tileValue}`} />
                <span className={`${styles.bone} ${styles.tileLabel}`} />
              </span>
            ))}
          </div>
        )}
        {rows > 0 && (
          <div className={`card ${styles.list}`}>
            {Array.from({ length: rows }, (_, i) => (
              <span key={i} className={styles.row}>
                {dots && <span className={`${styles.bone} ${styles.dot}`} />}
                <span className={styles.lines}>
                  <span className={`${styles.bone} ${styles.line}`} />
                  <span className={`${styles.bone} ${styles.lineShort}`} />
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
