package com.sidequest.arena.matches.dto;

import java.util.List;

/** A round/map of a match with its per-franchise result lines (best rank first). */
public record MatchRoundView(
        int roundNumber,
        String mapName,
        String mode,
        List<RoundResultView> rows
) {
    public record RoundResultView(
            int rank,
            String franchiseId,
            String franchiseName,
            String franchiseTag,
            int kills,
            int survivalSeconds,
            int placePts,
            List<PlayerStatView> players
    ) {
    }

    /** A single player's stat line within a franchise's round result. Empty when not entered. */
    public record PlayerStatView(
            String playerId,
            String gamerTag,
            int kills,
            int survivalSeconds
    ) {
    }
}
