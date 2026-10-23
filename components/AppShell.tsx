import type { SessionUser } from "@/lib/auth";
import { getThemePref } from "@/lib/theme-server";
import { TabBar } from "./TabBar";
import styles from "./AppShell.module.css";

/** Signed-in chrome shared by member and admin layouts. */
export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const theme = await getThemePref();
  return (
    <>
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <TabBar isAdmin={user.role === "admin"} userName={user.name} theme={theme} />
      <div id="content" tabIndex={-1} className={styles.content}>
        {children}
      </div>
    </>
  );
}
