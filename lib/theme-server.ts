import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, type ThemePref } from "./theme";

export async function getThemePref(): Promise<ThemePref> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
