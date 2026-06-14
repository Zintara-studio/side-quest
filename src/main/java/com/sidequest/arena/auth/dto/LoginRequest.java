package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Login payload. {@code identifier} is either the account email or phone number.
 */
public record LoginRequest(
        @NotBlank String identifier,
        @NotBlank String password
) {
}
