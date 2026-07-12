package com.sidequest.arena.franchises.dto;

import java.time.Instant;

/**
 * A match a franchise played, with its result line (if published). Returned by
 * {@code GET /franchises/:id/matches}, sorted by {@code scheduledAt} descending.
 *
 * @param matchId     match id
 * @param matchSlug   the match's pretty slug (game-date-short), for building clean URLs
 * @param gameName    name of the game the match was for
 * @param scheduledAt when the match was scheduled
 * @param status      match status
 * @param rank        this franchise's final rank, or {@code null} if results are not published
 * @param total       this franchise's total points, or {@code null} if results are not published
 */
public record FranchiseMatchView(
        String matchId,
        String matchSlug,
        String gameName,
        Instant scheduledAt,
        String status,
        Integer rank,
        Integer total
) {
}
