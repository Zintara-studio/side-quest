/**
 * Per-game competitive rank presets, keyed by (lower-cased) game name. Drives the auction-registration
 * expertise form: a game with a known ladder gets a dropdown, anything else falls back to free text.
 * Labels mirror the real 2024/2025 ranked systems so franchises can scout on something objective.
 */
export const RANK_PRESETS: Record<string, string[]> = {
  valorant: [
    "Iron", "Bronze", "Silver", "Gold", "Platinum",
    "Diamond", "Ascendant", "Immortal", "Radiant",
  ],
  bgmi: [
    "Bronze", "Silver", "Gold", "Platinum", "Diamond",
    "Crown", "Ace", "Ace Master", "Ace Dominator", "Conqueror",
  ],
  cs2: [
    "Faceit 1", "Faceit 2", "Faceit 3", "Faceit 4", "Faceit 5",
    "Faceit 6", "Faceit 7", "Faceit 8", "Faceit 9", "Faceit 10",
  ],
  "free fire": [
    "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Heroic", "Grandmaster",
  ],
  cod: [
    "Rookie", "Veteran", "Elite", "Pro", "Master", "Grandmaster", "Legendary",
  ],
  "marvel rivals": [
    "Bronze", "Silver", "Gold", "Platinum", "Diamond",
    "Grandmaster", "Celestial", "Eternity", "One Above All",
  ],
};

/** The rank preset list for a game name, or null when the game has no known ladder (use free text). */
export function ranksFor(gameName: string | null | undefined): string[] | null {
  if (!gameName) return null;
  return RANK_PRESETS[gameName.trim().toLowerCase()] ?? null;
}
