import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/(auth)/auth.module.css";
import formStyles from "@/components/Form.module.css";
import { isResetTokenValid } from "@/lib/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

// The token is in the URL: never send it on in a Referer header.
export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && (await isResetTokenValid(token));

  return (
    <>
      <h1 className={styles.title}>Choose a new password</h1>
      {valid ? (
        <>
          <p className={styles.lead}>You’ll be signed out on all devices, then you can sign in with the new password.</p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <>
          <p className={formStyles.alert} role="status">
            This reset link has expired or was already used. Links work once, for 60 minutes.
          </p>
          <Link href="/forgot-password" className={formStyles.button}>
            Request a new link
          </Link>
        </>
      )}
      <p className={styles.alt}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </>
  );
}
