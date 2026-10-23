import Image from "next/image";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { withBase } from "@/lib/base-path";
import { getThemePref } from "@/lib/theme-server";
import styles from "./auth.module.css";

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getThemePref();
  return (
    <main className={styles.main}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <Image src={withBase("/logo.webp")} alt="" width={72} height={72} priority className={styles.logo} />
          <p className={styles.society}>Society of Saint Carlo Acutis</p>
        </div>
        {children}
        <div className={styles.theme}>
          <ThemeSwitcher initial={theme} />
        </div>
      </div>
    </main>
  );
}
