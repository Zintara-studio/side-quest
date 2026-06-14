package com.sidequest.arena.players.dto;

import com.sidequest.arena.model.PlayerStatus;
import jakarta.validation.constraints.NotNull;

/**
 * Admin payload for {@code PATCH /players/{id}/status}.
 *
 * @param status the new account standing (required)
 */
public record UpdateStatusRequest(
        @NotNull PlayerStatus status
) {
}
