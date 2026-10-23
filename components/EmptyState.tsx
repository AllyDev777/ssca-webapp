import Image from "next/image";
import { withBase } from "@/lib/base-path";
import styles from "./EmptyState.module.css";

/** Friendly empty state with the society logo faintly behind the text. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={`card ${styles.empty}`}>
      <Image src={withBase("/logo.webp")} alt="" width={180} height={180} className={styles.watermark} />
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
