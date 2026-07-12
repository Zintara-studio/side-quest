package com.sidequest.arena.players.dto;

import java.time.Instant;

/**
 * A past or scheduled match for the player's franchise, with the franchise's placement when known.
 *
 * @param matchId       the match id
 * @param matchSlug     the match's pretty slug (game-date-short), for building clean URLs
 * @param gameName      the title played
 * @param scheduledAt   kick-off time
 * @param status        {@link com.sidequest.arena.model.MatchStatus} name
 * @param franchiseRank the franchise's final rank in the match, or {@code null} if not yet resulted
 * @param total         the franchise's total points in the match, or {@code null} if not yet resulted
 */
public record PlayerMatchView(
        String matchId,
        String matchSlug,
        String gameName,
        Instant scheduledAt,
        String status,
        Integer franchiseRank,
        Integer total
) {
}
