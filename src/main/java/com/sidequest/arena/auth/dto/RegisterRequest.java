package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Self-service registration payload. Creates a {@code PLAYER} user plus a {@code PENDING} player
 * profile. {@code phone} is optional; {@code password} must be at least 8 characters.
 */
public record RegisterRequest(
        @NotBlank String name,
        @NotBlank @Email String email,
        String phone,
        @NotBlank @Size(min = 8, message = "password must be at least 8 characters") String password
) {
}
