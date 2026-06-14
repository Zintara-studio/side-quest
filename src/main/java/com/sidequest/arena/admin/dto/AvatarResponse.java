package com.sidequest.arena.admin.dto;

/**
 * Response for {@code POST /uploads/avatar}.
 *
 * @param playerId  the player the avatar was attached to
 * @param avatarUrl the avatar URL now in effect
 */
public record AvatarResponse(
        String playerId,
        String avatarUrl
) {
}
