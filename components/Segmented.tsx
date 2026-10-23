import Link from "next/link";
import styles from "./Segmented.module.css";

type Option = { value: string; label: string; href: string };

/** iOS segmented control made of links (works without JavaScript). */
export function Segmented({ options, value, label }: { options: Option[]; value: string; label: string }) {
  return (
    <nav className={styles.control} aria-label={label}>
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          className={styles.segment}
          aria-current={o.value === value ? "page" : undefined}
          scroll={false}
          replace
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
