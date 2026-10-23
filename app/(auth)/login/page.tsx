import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import styles from "../auth.module.css";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.lead}>Sign in to log this week’s activities.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className={styles.alt}>
        New here? <Link href="/register">Create an account</Link>
      </p>
    </>
  );
}
