package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Token rotation payload carrying the raw refresh token previously issued to the client.
 */
public record RefreshRequest(
        @NotBlank String refreshToken
) {
}
