import "server-only";
import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/**
 * Client IP + user agent for rate limiting, sessions and the audit log.
 * Next.js only fills X-Forwarded-For when it is absent, so in production run behind a
 * reverse proxy that overwrites X-Real-IP (or appends to X-Forwarded-For); otherwise
 * clients can choose their own IP.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    null;
  return {
    ip: ip ? ip.slice(0, 45) : null,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
  };
}
