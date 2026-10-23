"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { EmptyState } from "./EmptyState";
import styles from "./ErrorView.module.css";

type Props = { error: Error & { digest?: string }; reset: () => void; standalone?: boolean };

/**
 * Friendly error screen for error.tsx boundaries. In production Next.js replaces
 * server error messages with a digest, so no internals reach the user.
 */
export function ErrorView({ error, reset, standalone = false }: Props) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={standalone ? styles.standalone : "page"}>
      <div className={styles.wrap}>
        <EmptyState title="Something went wrong">
          <p>Please try again. If it keeps happening, check your connection or come back in a few minutes.</p>
          {error.digest && <p className={styles.ref}>Reference: {error.digest}</p>}
        </EmptyState>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={retrying}
            onClick={() =>
              startRetry(() => {
                router.refresh(); // re-run server components
                reset();
              })
            }
          >
            {retrying ? "Retrying…" : "Try again"}
          </button>
          <Link href="/" className={styles.link}>
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
