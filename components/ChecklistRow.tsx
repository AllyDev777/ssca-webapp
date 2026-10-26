import type { ReactNode } from "react";
import { CheckIcon } from "./icons";
import styles from "./ChecklistRow.module.css";

type Props = {
  id: number;
  title: string;
  description: string | null;
  points: number;
  checked: boolean;
  disabled?: boolean;
  /** Plays the spring animation; set only for user-initiated changes. */
  animate?: boolean;
  onToggle?: () => void;
  /** Extra content under the row, e.g. a note box. */
  children?: ReactNode;
};

/**
 * One iOS-style checklist row backed by a real (visually hidden) checkbox.
 * The whole row is the label, so its accessible name is title + description + points.
 */
export function ChecklistRow({ id, title, description, points, checked, disabled, animate, onToggle, children }: Props) {
  return (
    <li className={styles.item}>
      <label className={styles.row} data-disabled={disabled || undefined}>
        <input
          type="checkbox"
          name={`activity-${id}`}
          className={styles.input}
          checked={checked}
          disabled={disabled}
          readOnly={!onToggle}
          onChange={onToggle}
        />
        <span className={styles.check} data-animate={animate || undefined} aria-hidden="true">
          <span className={styles.fill} />
          <CheckIcon className={styles.tick} width={16} height={16} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {description && <span className={styles.desc}>{description}</span>}
        </span>
        <span className={`${styles.pill} num`}>
          +{points}
          <span className="visually-hidden"> points</span>
        </span>
      </label>
      {children}
    </li>
  );
}
