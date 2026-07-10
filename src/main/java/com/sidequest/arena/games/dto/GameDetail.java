package com.sidequest.arena.games.dto;

import java.util.List;

/**
 * Full title detail: the game's fields, its system-wide scoring config (publicly visible), plus its
 * recent matches (newest first).
 *
 * @param pointsPerKill   points per kill/score for this title
 * @param placementPoints placement ladder (comma-separated, highest-first; empty = kills only)
 * @param standingsWeight the title's weight toward franchise standings, in basis points (100 = 1.00×)
 */
public record GameDetail(
        String id,
        String name,
        String format,
        String gameType,
        String iconUrl,
        boolean enabled,
        int popularity,
        int pointsPerKill,
        String placementPoints,
        int standingsWeight,
        List<GameMatchView> matches
) {
}
