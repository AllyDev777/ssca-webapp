import type { Metadata, Viewport } from "next";
import { withBase } from "@/lib/base-path";
import { THEME_COLORS } from "@/lib/theme";
import { getThemePref } from "@/lib/theme-server";
import "./globals.css";

// Every page is rendered per request so it receives the CSP nonce from middleware.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Weekly Spiritual Growth", template: "%s · SSCA" },
  description: "Weekly spiritual growth assessment for the Society of Saint Carlo Acutis.",
  // Small dedicated icons (the tab icon is ~2 KB instead of the full logo).
  icons: {
    icon: [{ url: withBase("/favicon-32.png"), sizes: "32x32", type: "image/png" }],
    apple: [{ url: withBase("/apple-touch-icon.png"), sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "SSCA", statusBarStyle: "default" },
  // Private members' app: keep every page out of search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemePref();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover", // lets env(safe-area-inset-*) work under the tab bar
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
          ]
        : THEME_COLORS[theme],
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getThemePref();
  return (
    // data-theme forces light/dark; absent = follow the system (see globals.css).
    <html lang="en" data-theme={theme === "system" ? undefined : theme}>
      <body>{children}</body>
    </html>
  );
}
