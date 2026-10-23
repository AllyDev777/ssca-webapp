"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LargeTitle.module.css";

/**
 * iOS large title: a big heading that, once scrolled away, is replaced by a
 * compact sticky bar showing the same title.
 */
export function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry?.isIntersecting), {
      rootMargin: "-44px 0px 0px 0px", // the compact bar's height
    });
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className={styles.bar} data-compact={compact || undefined} aria-hidden="true">
        <span className={styles.barTitle}>{title}</span>
      </div>
      <header className={styles.header}>
        <h1 ref={headingRef} className={styles.title}>
          {title}
        </h1>
        {subtitle && <p className={`${styles.subtitle} num`}>{subtitle}</p>}
      </header>
    </>
  );
}
