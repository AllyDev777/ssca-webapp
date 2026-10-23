import styles from "./ProgressRing.module.css";

type Props = { value: number; max: number; size?: number; label?: string };

/** Circular progress (SVG). Teal while in progress, leaf green when complete. */
export function ProgressRing({ value, max, size = 132, label = "pts" }: Props) {
  const stroke = Math.round(size * 0.09);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const done = max > 0 && value >= max;

  return (
    <div
      className={styles.ring}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of ${max} ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={done ? `${styles.bar} ${styles.done}` : styles.bar}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.center} aria-hidden="true">
        <span className={`${styles.value} num`}>
          {value}
          <span className={styles.max}> / {max}</span>
        </span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
