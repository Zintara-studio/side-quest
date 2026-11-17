package com.sidequest.arena.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Body for {@code POST /auth/reset-password}: email + 6-digit code + the new password. */
public record ResetPasswordRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "code must be 6 digits") String code,
        @NotBlank @Size(min = 8, message = "password must be at least 8 characters") String newPassword
) {
}
