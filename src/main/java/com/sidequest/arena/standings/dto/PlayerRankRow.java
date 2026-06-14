package com.sidequest.arena.standings.dto;

/**
 * A row in the global player leaderboard.
 *
 * @param rank         1-based position by points desc
 * @param playerId     player id
 * @param gamerTag     public handle
 * @param avatarUrl    avatar image url, nullable
 * @param points       accumulated points
 * @param franchiseTag tag of the player's franchise, or {@code null} if unassigned
 */
public record PlayerRankRow(
        int rank,
        String playerId,
        String gamerTag,
        String avatarUrl,
        int points,
        String franchiseTag
) {
}
