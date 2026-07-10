package com.sidequest.arena.matches.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body for {@code POST /matches/{id}/messages} — an admin posts a message into the live match room.
 *
 * @param body message text (required, ≤ 2000 chars)
 */
public record PostMatchMessageRequest(
        @NotBlank @Size(max = 2000) String body
) {
}
