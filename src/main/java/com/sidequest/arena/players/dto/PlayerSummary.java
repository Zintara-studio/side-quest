package com.sidequest.arena.players.dto;

/**
 * Compact player projection for list endpoints (leaderboard / directory). Includes the player's
 * franchise reference when assigned.
 *
 * @param id            player id
 * @param gamerTag      public handle
 * @param avatarUrl     avatar image url (nullable)
 * @param region        player region (nullable)
 * @param status        {@link com.sidequest.arena.model.PlayerStatus} name
 * @param points        accumulated leaderboard points
 * @param franchiseId   owning franchise id, or {@code null} if unassigned
 * @param franchiseName owning franchise name, or {@code null} if unassigned
 */
public record PlayerSummary(
        String id,
        String gamerTag,
        String avatarUrl,
        String region,
        String status,
        int points,
        String franchiseId,
        String franchiseName
) {
}
