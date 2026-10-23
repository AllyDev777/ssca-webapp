import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/app/(auth)/auth.module.css";
import formStyles from "@/components/Form.module.css";
import { getCurrentUser } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mail";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/account");

  return (
    <>
      <h1 className={styles.title}>Forgot password?</h1>
      <p className={styles.lead}>Enter your email and we’ll send you a link to choose a new one.</p>
      {isMailConfigured() ? (
        <ForgotPasswordForm />
      ) : (
        <p className={formStyles.alert} role="status">
          Password reset by email isn’t set up yet. Please ask an admin to help you sign in.
        </p>
      )}
      <p className={styles.alt}>
        Remembered it? <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}
