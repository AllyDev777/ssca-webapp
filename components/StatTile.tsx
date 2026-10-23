import styles from "./StatTile.module.css";

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  tone: "teal" | "leaf" | "coral" | "sun";
};

export function StatTile({ label, value, unit, tone }: Props) {
  return (
    <div className={styles.tile} data-tone={tone}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} num`}>
        {value}
        {unit && <span className={styles.unit}> {unit}</span>}
      </span>
    </div>
  );
}

export function StatGrid({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section className={styles.grid} aria-label={label}>
      {children}
    </section>
  );
}
