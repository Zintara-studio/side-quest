package com.sidequest.arena.auth.dto;

/**
 * Result of register / login / refresh. Carries a freshly minted access token, the raw refresh
 * token (stored only as a hash server-side), the access token TTL, and a compact user view.
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UserView user
) {

    /** Minimal user projection returned alongside tokens. */
    public record UserView(
            String id,
            String name,
            String email,
            String role
    ) {
    }
}
