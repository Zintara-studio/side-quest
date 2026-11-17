"use client";

import { useCurrentSeason } from "@/lib/query/hooks";

/**
 * Renders the current season's code (e.g. "S05"), resolved live from the API. Use inside server
 * components (like the auth layout) that can't call the hook directly. Falls back while loading /
 * between seasons.
 */
export function SeasonCode({ fallback = "—" }: { fallback?: string }) {
  const season = useCurrentSeason().data;
  return <>{season?.code ?? fallback}</>;
}
