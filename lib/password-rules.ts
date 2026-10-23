// Pure password rules — no native imports, so client components can use them too.

export const PASSWORD_MIN = 8;
// Caps hashing cost for absurd inputs.
export const PASSWORD_MAX = 128;

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789",
  "1234567890", "11111111", "00000000", "87654321", "qwertyui", "qwerty123",
  "qwertyuiop", "asdfghjk", "iloveyou", "abc12345", "abcd1234", "letmein1",
  "welcome1", "welcome123", "admin123", "administrator", "sunshine", "princess",
  "football", "baseball", "superman", "trustno1", "changeme", "jesus123",
  "jesuschrist", "godisgood", "blessed1", "carloacutis", "acutis123",
]);

/** Returns a user-facing error message, or null if the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common. Please choose another.";
  return null;
}
