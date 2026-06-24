package com.sidequest.arena.franchises.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload for assigning a franchise role (owner or manager) to a player.
 *
 * @param playerId the player to elevate (required)
 */
public record AssignRoleRequest(
        @NotBlank String playerId
) {
}
