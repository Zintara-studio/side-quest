package com.sidequest.arena.standings.dto;

/**
 * A row in a per-title proficiency ranking.
 *
 * @param rank     1-based position by rating desc
 * @param playerId player id
 * @param gamerTag public handle
 * @param rating   self-rated proficiency (0–100) for the title
 */
public record GameRankRow(
        int rank,
        String playerId,
        String gamerTag,
        int rating
) {
}
