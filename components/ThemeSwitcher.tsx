"use client";

import { useId, useState } from "react";
import { THEME_COLORS, THEME_COOKIE, THEME_MAX_AGE, type ThemePref } from "@/lib/theme";
import { AutoIcon, MoonIcon, SunIcon } from "./icons";
import styles from "./ThemeSwitcher.module.css";

const OPTIONS = [
  { value: "system", label: "Auto", Icon: AutoIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
] as const;

function apply(theme: ThemePref) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;

  // Keep the browser's address-bar colour in step.
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const color = THEME_COLORS[theme === "system" ? (prefersDark ? "dark" : "light") : theme];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Auto / Light / Dark segmented control built from real radio buttons (arrow keys work natively). */
export function ThemeSwitcher({ initial }: { initial: ThemePref }) {
  const [theme, setTheme] = useState<ThemePref>(initial);
  const name = useId();

  return (
    <fieldset className={styles.switcher}>
      <legend className="visually-hidden">Appearance</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <label key={value} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={theme === value}
            onChange={() => {
              setTheme(value);
              apply(value);
            }}
            className={styles.input}
          />
          <span className={styles.face}>
            <Icon width={18} height={18} />
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
