"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/actions/auth";
import { withBase } from "@/lib/base-path";
import type { ThemePref } from "@/lib/theme";
import { ChecklistIcon, HistoryIcon, HomeIcon, LogOutIcon, ShieldIcon } from "./icons";
import { ThemeSwitcher } from "./ThemeSwitcher";
import styles from "./TabBar.module.css";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/week", label: "This Week", Icon: ChecklistIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
] as const;

const ADMIN_TAB = { href: "/admin", label: "Admin", Icon: ShieldIcon } as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar on phones; left sidebar from 900px. */
export function TabBar({ isAdmin, userName, theme }: { isAdmin: boolean; userName: string; theme: ThemePref }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  // Optimistic highlight: the tapped tab lights up at once, before the page arrives.
  // It's tied to the path it was tapped from, so it clears itself once navigation lands.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const highlighted = pending && pending.from === pathname ? pending.href : null;

  return (
    <nav className={styles.bar} aria-label="Main">
      <div className={styles.brand}>
        <Image src={withBase("/logo.webp")} alt="" width={28} height={28} />
        <span>SSCA</span>
      </div>
      <ul className={styles.tabs}>
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const lit = highlighted ? highlighted === href : active;
          return (
            <li key={href}>
              <Link
                href={href}
                className={styles.tab}
                aria-current={active ? "page" : undefined}
                data-lit={lit || undefined}
                data-pending={highlighted === href || undefined}
                onClick={(e) => {
                  // Leave new-tab / new-window clicks alone.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  if (!active) setPending({ href, from: pathname });
                }}
              >
                <Icon className={styles.icon} />
                <span className={styles.label}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Desktop only; phones get these on the Home screen. */}
      <div className={styles.footer}>
        <ThemeSwitcher initial={theme} />
        <form action={logout} className={styles.signOutForm}>
          <Link href="/account" className={styles.user} aria-label={`${userName}: account settings`}>
            <span className={styles.userName}>{userName}</span>
            <span className={styles.userHint}>Account settings ›</span>
          </Link>
          <button type="submit" className={styles.signOut}>
            <LogOutIcon width={20} height={20} />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
