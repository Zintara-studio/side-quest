package com.sidequest.arena.games.dto;

/**
 * Compact view of a supported title for the games grid: identity, format, visibility flag, the
 * popularity score, and the title's system-wide scoring config (so players can see how each game is
 * scored and how much it weighs toward the league standings).
 *
 * @param pointsPerKill   points per kill/score for this title
 * @param placementPoints placement ladder (comma-separated, highest-first; empty = kills only)
 * @param standingsWeight the title's weight toward franchise standings, in basis points (100 = 1.00×)
 */
public record GameSummary(
        String id,
        String name,
        String format,
        String gameType,
        String iconUrl,
        boolean enabled,
        int popularity,
        int pointsPerKill,
        String placementPoints,
        int standingsWeight
) {
}
