// Shared by lib/auth.ts and scripts/create-admin.ts. Intentionally not marked
// "server-only" so the CLI script can import it; the native argon2 module
// cannot be bundled for the browser anyway.
import { hash, verify } from "@node-rs/argon2";

export { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "./password-rules";

// argon2id (the library default algorithm) with OWASP-recommended parameters.
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed hash: treat as a failed match rather than leaking an error.
    return false;
  }
}
