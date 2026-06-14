package com.sidequest.arena.franchises.dto;

/**
 * A player on a franchise's roster, as returned by {@code GET /franchises/:id/roster}.
 *
 * @param playerId  player id
 * @param gamerTag  player's public handle
 * @param avatarUrl avatar image url (nullable)
 * @param status    player status (e.g. PENDING, VERIFIED)
 * @param isIgl     whether this player is the franchise's in-game leader
 */
public record RosterMember(
        String playerId,
        String gamerTag,
        String avatarUrl,
        String status,
        boolean isIgl
) {
}
