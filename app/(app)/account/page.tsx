import type { Metadata } from "next";
import { logout } from "@/actions/auth";
import { LargeTitle } from "@/components/LargeTitle";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { countActiveSessions, requireUser } from "@/lib/auth";
import { getThemePref } from "@/lib/theme-server";
import { NameForm, OtherDevicesButton, PasswordForm } from "./AccountForms";
import styles from "./account.module.css";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const [sessions, theme] = await Promise.all([countActiveSessions(user.id), getThemePref()]);
  const others = Math.max(sessions - 1, 0);

  return (
    <main className="page">
      <LargeTitle title="Account" subtitle={user.email} />

      <section className={styles.section} aria-labelledby="profile-h">
        <h2 id="profile-h" className={styles.h2}>
          Profile
        </h2>
        <NameForm name={user.name} />
      </section>

      <section className={styles.section} aria-labelledby="password-h">
        <h2 id="password-h" className={styles.h2}>
          Password
        </h2>
        <PasswordForm />
      </section>

      <section className={styles.section} aria-labelledby="devices-h">
        <h2 id="devices-h" className={styles.h2}>
          Devices
        </h2>
        <div className={`card ${styles.panel}`}>
          <p className={styles.devices}>
            {others === 0
              ? "You're only signed in on this device."
              : `Signed in on this device and ${others} other${others === 1 ? "" : "s"}.`}
          </p>
          <OtherDevicesButton otherDevices={others} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="appearance-h">
        <h2 id="appearance-h" className={styles.h2}>
          Appearance
        </h2>
        <ThemeSwitcher initial={theme} />
      </section>

      <form action={logout} className={styles.section}>
        <button type="submit" className={styles.signOut}>
          Sign out
        </button>
      </form>
    </main>
  );
}
