package com.sidequest.arena.franchises.dto;

import com.sidequest.arena.model.FranchiseRole;

/**
 * Request body for inviting a player into a franchise's owner or manager slot. Identify the invitee by
 * either their gamer tag or player id (at least one is required, validated in the service). The role is
 * required. An optional message is delivered with the invite.
 *
 * @param gamerTag the invitee's gamer tag, nullable if {@code playerId} is given
 * @param playerId the invitee's player id, nullable if {@code gamerTag} is given
 * @param role     the franchise slot offered ({@code OWNER} or {@code MANAGER})
 * @param message  optional note shown to the invitee, nullable
 */
public record FranchiseInviteRequest(
        String gamerTag,
        String playerId,
        FranchiseRole role,
        String message
) {
}
