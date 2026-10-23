// Registration is limited to well-known email providers. Matching is exact on the
// lower-cased domain, so lookalikes (paypa1.com, gmai1.com), subdomain tricks
// (gmail.com.evil.io) and Unicode homoglyphs are all rejected.
// Edit this list to allow another provider (e.g. a parish domain).

export const ALLOWED_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // Google
  "gmail.com",
  "googlemail.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  // Microsoft (Outlook and its older addresses)
  "outlook.com",
  "outlook.in",
  "hotmail.com",
  "live.com",
  "msn.com",
  // Apple
  "me.com",
  "icloud.com",
  "mac.com",
  // AOL
  "aol.com",
]);

export const ALLOWED_PROVIDERS_TEXT = "Gmail, Yahoo, Outlook/Hotmail, iCloud (me.com) or AOL";

export function isAllowedEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  return at > 0 && ALLOWED_EMAIL_DOMAINS.has(email.slice(at + 1).toLowerCase());
}
