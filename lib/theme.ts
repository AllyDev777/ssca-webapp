// Appearance preference, stored in a plain (non-HttpOnly) cookie so the server can
// render <html data-theme> up front (no flash, no inline script needed under the CSP)
// and the client switcher can update it instantly.

export const THEME_COOKIE = "theme";
export const THEME_MAX_AGE = 365 * 24 * 60 * 60;

export type ThemePref = "system" | "light" | "dark";

/** Light is the default; "Auto" (system) and Dark are opt-in via the switcher. */
export function parseTheme(value: string | undefined): ThemePref {
  return value === "dark" || value === "system" ? value : "light";
}

/** Browser UI colour (address bar etc.) for each theme. */
export const THEME_COLORS = { light: "#F4F6FA", dark: "#0E1120" } as const;
