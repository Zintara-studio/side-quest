package com.sidequest.arena.registrations.dto;

import jakarta.validation.constraints.Size;

/**
 * Request body for inviting a teammate to a SQUAD registration. Identify the invitee by either their
 * gamer tag (preferred) or player id; at least one must be supplied (validated in the service). An
 * optional message is delivered with the invite.
 *
 * @param gamerTag the invitee's gamer tag, nullable if {@code playerId} is given
 * @param playerId the invitee's player id, nullable if {@code gamerTag} is given
 * @param message  optional note shown to the invitee, nullable
 */
public record InviteRequest(
        String gamerTag,
        String playerId,
        @Size(max = 500) String message
) {
}
