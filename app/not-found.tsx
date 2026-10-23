import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import styles from "@/components/ErrorView.module.css";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className={styles.standalone}>
      <div className={styles.wrap}>
        <EmptyState title="Page not found">
          <p>This page doesn’t exist, or you don’t have access to it.</p>
        </EmptyState>
        <div className={styles.actions}>
          <Link href="/" className={styles.link}>
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
