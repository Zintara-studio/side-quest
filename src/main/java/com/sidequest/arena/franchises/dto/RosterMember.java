package com.sidequest.arena.franchises.dto;

import java.util.List;

/**
 * A player on a franchise's roster, as returned by {@code GET /franchises/:id/roster}.
 *
 * <p>The contact fields ({@code realName}, {@code phone}, {@code contactEmail}) and the franchise-private
 * {@code tags} are populated only for a caller who leads THIS franchise (its owner or manager) or an
 * admin; for spectators and other franchises' leaders they are {@code null}. This lets a franchise's
 * leadership see their own roster's contact details and designation tags without exposing them.
 *
 * @param playerId     player id
 * @param gamerTag     player's public handle
 * @param avatarUrl    avatar image url (nullable)
 * @param status       player status (e.g. PENDING, VERIFIED)
 * @param role         the player's role on this franchise: OWNER / MANAGER / PLAYER
 * @param realName     real name (leaders/admin only, else {@code null})
 * @param phone        contact phone (leaders/admin only, else {@code null})
 * @param contactEmail contact email (leaders/admin only, else {@code null})
 * @param tags         franchise-private designation tags (leaders/admin only, else {@code null})
 */
public record RosterMember(
        String playerId,
        String gamerTag,
        String avatarUrl,
        String status,
        String role,
        String realName,
        String phone,
        String contactEmail,
        List<String> tags
) {
}
