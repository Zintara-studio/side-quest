package com.sidequest.arena.auth.dto;

/**
 * Response to {@code POST /auth/register}. No session is issued at registration — the account must first
 * be verified via the emailed OTP ({@code POST /auth/verify-email}), which is what returns a token pair.
 *
 * @param email                the address a verification code was sent to
 * @param verificationRequired always true today — signals the frontend to route to the verify screen
 */
public record RegisterResponse(String email, boolean verificationRequired) {
}
