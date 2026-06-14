package com.sidequest.arena.auth.dto;

/**
 * Logout payload. If {@code refreshToken} is supplied only that token is revoked; otherwise all
 * refresh tokens for the authenticated user are revoked.
 */
public record LogoutRequest(
        String refreshToken
) {
}
