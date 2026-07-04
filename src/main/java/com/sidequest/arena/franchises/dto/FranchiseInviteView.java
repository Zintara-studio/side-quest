package com.sidequest.arena.franchises.dto;

import java.time.Instant;

/**
 * A franchise owner/manager invitation, as seen by the invited player or listed for the franchise.
 *
 * @param id                     invite id
 * @param franchiseId            the franchise the invite is for
 * @param franchiseName          the franchise name
 * @param franchiseTag           the franchise short tag
 * @param role                   {@link com.sidequest.arena.model.FranchiseRole} name (OWNER/MANAGER)
 * @param invitedByGamerTag      the sender's gamer tag
 * @param invitedPlayerGamerTag  the invitee's gamer tag
 * @param status                 {@link com.sidequest.arena.model.InviteStatus} name
 * @param message                optional note from the sender, nullable
 * @param createdAt              when the invite was sent
 */
public record FranchiseInviteView(
        String id,
        String franchiseId,
        String franchiseName,
        String franchiseTag,
        String role,
        String invitedByGamerTag,
        String invitedPlayerGamerTag,
        String status,
        String message,
        Instant createdAt
) {
}
