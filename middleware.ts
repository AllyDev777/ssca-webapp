import { NextResponse, type NextRequest } from "next/server";
import {
  RENEW_AFTER,
  ROLE_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  isTokenShape,
  signRoleHint,
  verifyRoleHint,
} from "@/lib/session-cookie";

/**
 * Runs before every page/API request:
 * 1. Per-request CSP nonce (Next.js reads it from the request header and applies it to its scripts).
 * 2. Route gating — redirects signed-out users to /login and non-admins away from /admin.
 *    This only checks cookies; real authorization happens in requireUser()/requireAdmin().
 * 3. Sliding renewal of the session cookies.
 * Static security headers (X-Frame-Options, HSTS, …) are set in next.config.ts.
 */

const PUBLIC_PAGES = new Set(["/login", "/register"]);
const isDev = process.env.NODE_ENV !== "production";

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // React dev tooling needs eval; production does not.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline *styles* only (next/image sets style attributes). Inline scripts stay blocked.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`, // dev: hot-reload websocket
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Absolute URL inside the app. Cloning nextUrl keeps the configured basePath
 * (e.g. /ssca), which `new URL("/login", req.url)` would drop.
 */
function appUrl(req: NextRequest, path: string, params: Record<string, string> = {}): URL {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const rawToken = req.cookies.get(SESSION_COOKIE)?.value;
  const token = rawToken && isTokenShape(rawToken) ? rawToken : null;
  const hint = token ? await verifyRoleHint(req.cookies.get(ROLE_COOKIE)?.value, token) : null;

  // --- Gating -------------------------------------------------------------
  let blocked: NextResponse | null = null;
  if (isUnder(pathname, "/api")) {
    if (isUnder(pathname, "/api/admin") && hint?.role !== "admin") {
      blocked = NextResponse.json({ error: token ? "Forbidden" : "Unauthorized" }, { status: token ? 403 : 401 });
    }
  } else if (!PUBLIC_PAGES.has(pathname)) {
    if (!token) {
      blocked = NextResponse.redirect(appUrl(req, "/login", pathname !== "/" ? { next: pathname + search } : {}));
    } else if (isUnder(pathname, "/admin") && hint?.role !== "admin") {
      blocked = NextResponse.redirect(appUrl(req, "/"));
    }
  }
  if (blocked) {
    blocked.headers.set("Content-Security-Policy", csp);
    return blocked;
  }

  // --- Pass through with nonce -------------------------------------------
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);

  // Sliding renewal: re-issue both cookies (fresh 7-day max-age) about once a day.
  // The DB expiry is extended on the same schedule in getCurrentUser().
  if (token && hint && Date.now() / 1000 - hint.issuedAt > RENEW_AFTER) {
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    res.cookies.set(ROLE_COOKIE, await signRoleHint(hint.role, token), cookieOptions);
  }
  return res;
}

export const config = {
  // Everything except build assets and files with an extension (logo, robots.txt, …).
  matcher: ["/((?!_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)"],
};
