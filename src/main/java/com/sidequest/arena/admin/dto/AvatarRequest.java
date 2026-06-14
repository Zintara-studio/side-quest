package com.sidequest.arena.admin.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for {@code POST /uploads/avatar}.
 *
 * @param playerId  the target player; when omitted the current user's player is used
 * @param avatarUrl the avatar URL to attach (required)
 */
public record AvatarRequest(
        String playerId,
        @NotBlank String avatarUrl
) {
}
