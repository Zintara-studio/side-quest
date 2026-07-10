package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Body for the email-only endpoints ({@code /auth/resend-verification}, {@code /auth/forgot-password}). */
public record EmailRequest(
        @NotBlank @Email String email
) {
}
