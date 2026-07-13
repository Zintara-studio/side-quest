"use client";

// Minimal SSR-safe media-query hook. Starts false on the server / first client render (so markup
// matches during hydration), then reflects the real match after mount and on every change. Used to
// drive the layout switches (e.g. the admin sidebar → mobile drawer) that inline styles can't express.
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
