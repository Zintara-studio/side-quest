package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Body for {@code POST /auth/verify-email}: the email and its 6-digit numeric code. */
public record VerifyEmailRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "code must be 6 digits") String code
) {
}
