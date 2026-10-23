// Optional sub-path deployment, e.g. https://example.org/ssca.
// Set NEXT_PUBLIC_BASE_PATH=/ssca *before* `npm run build` (it's baked into the build).
// Leave it unset to serve the app from the domain root (the default).
//
// <Link>, redirect(), router and server actions add the base path automatically.
// Use withBase() only for plain URLs Next.js doesn't rewrite: <Image src>, plain
// <form action>, icon and manifest URLs.

export const BASE_PATH = normalise(process.env.NEXT_PUBLIC_BASE_PATH);

function normalise(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
