import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import styles from "../auth.module.css";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <>
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.lead}>Track your spiritual growth, week by week.</p>
      <RegisterForm />
      <p className={styles.alt}>
        Already a member? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}
