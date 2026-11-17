// Client mirror of the backend UsernameRules (players/UsernameRules.java). Kept in lock-step so the
// signup + onboarding forms give instant feedback with the exact rules the server enforces (the server
// remains authoritative — this is UX, not a security boundary).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Returns null when the shape is valid, else a human-readable reason. Does NOT check uniqueness. */
export function validateUsername(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "Pick a username.";
  if (s.includes(" ")) return "Username can't contain spaces.";
  if (s.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (s.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`;
  if (!/^[A-Za-z0-9_.-]+$/.test(s)) return "Use only letters, numbers, and . _ -";
  return null;
}
