package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for {@code POST /auth/google}: the Google Sign-In id_token to be verified server-side. */
public record GoogleLoginRequest(
        @NotBlank String idToken
) {
}
