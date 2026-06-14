package com.sidequest.arena.franchises.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Admin payload for {@code POST /franchises/:id/roster}: the id of the player to assign to the
 * franchise's roster.
 *
 * @param playerId id of the player to assign (required)
 */
public record AssignPlayerRequest(
        @NotBlank String playerId
) {
}
