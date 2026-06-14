package com.sidequest.arena.auth.dto;

/**
 * Current-session snapshot for {@code GET /auth/me}: the authenticated user plus their player
 * profile ({@code null} if the account has no associated player).
 */
public record MeResponse(
        UserView user,
        PlayerView player
) {

    /** User fields exposed to the owning session. */
    public record UserView(
            String id,
            String name,
            String email,
            String phone,
            String role
    ) {
    }

    /** Player profile fields exposed to the owning session. */
    public record PlayerView(
            String id,
            String gamerTag,
            String avatarUrl,
            String status,
            int points,
            String franchiseId
    ) {
    }
}
