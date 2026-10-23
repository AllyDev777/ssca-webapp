import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";
import { THEME_COLORS } from "@/lib/theme";

// Served at /manifest.webmanifest: lets members "Add to Home Screen" / install the app,
// which then opens full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Weekly Spiritual Growth · SSCA",
    short_name: "SSCA",
    description: "Weekly spiritual growth assessment for the Society of Saint Carlo Acutis.",
    id: withBase("/"),
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: [
      { src: withBase("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
