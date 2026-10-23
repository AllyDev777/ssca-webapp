import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const isProd = process.env.NODE_ENV === "production";

// Static security headers for every response (pages, API, static files).
// The per-request CSP with a nonce is added in middleware.ts.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Also covers non-HTML responses (images, CSV, manifest) that can't carry a <meta> tag.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // "" = domain root; "/ssca" = https://example.org/ssca (see lib/base-path.ts).
  basePath: BASE_PATH,
  // BUILD_STANDALONE=1 produces .next/standalone: a self-contained server (`node server.js`)
  // with only the packages it needs. Used for the ready-to-run production package.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  // Native module: keep it out of the server bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
