package com.sidequest.arena.matches.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Admin payload to enter per-round results for a match. Every fixture is scored round-by-round.
 *
 * <p>The scoring weights for the fixture are carried on the request: {@code pointsPerKill} multiplies
 * each kill and {@code placementPoints} (a comma-separated, highest-first list, e.g. "15,12,10,8") sets
 * the points awarded by finishing rank in each round. When omitted the match's existing weights (seeded
 * from the league defaults) are kept. The server derives each round's placement points from the rank and
 * these weights — admins do not type placement points directly.
 *
 * <p>Each franchise's round line may optionally carry a per-player breakdown ({@code players}); when
 * present, the franchise's round kills are the sum of its players' kills.
 */
public record EnterRoundsRequest(
        Integer pointsPerKill,
        String placementPoints,
        @NotEmpty @Valid List<RoundEntry> rounds
) {
    public record RoundEntry(
            int roundNumber,
            String mapName,
            String mode,
            @NotEmpty @Valid List<RoundResultEntry> rows
    ) {
    }

    /**
     * One entrant's line in a round. For a FRANCHISE match set {@code franchiseId}; for an FFA match
     * set {@code playerId} (the individual entrant) and leave {@code franchiseId} null. Exactly one of
     * the two identifies the entrant.
     */
    public record RoundResultEntry(
            String franchiseId,
            String playerId,
            int rank,
            int kills,
            int survivalSeconds,
            @Valid List<PlayerStatEntry> players
    ) {
    }

    /** Optional per-player stat line within a franchise's round result. */
    public record PlayerStatEntry(
            @NotBlank String playerId,
            int kills,
            int survivalSeconds
    ) {
    }
}
