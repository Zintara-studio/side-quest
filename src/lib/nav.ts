/**
 * Resolve a `?next=` redirect to a safe SAME-ORIGIN path, or null.
 *
 * A naive `startsWith("/") && !startsWith("//")` guard is bypassable: the WHATWG URL parser normalizes a
 * backslash so `/\evil.com` resolves to `//evil.com` → an off-site origin. We instead reject any value
 * containing a backslash and compare the parsed origin to the current one. Client-side only.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.includes("\\")) return null;
  try {
    const u = new URL(raw, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : null;
  } catch {
    return null;
  }
}
