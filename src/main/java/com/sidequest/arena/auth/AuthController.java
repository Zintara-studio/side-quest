package com.sidequest.arena.auth;

import com.sidequest.arena.auth.dto.AuthResponse;
import com.sidequest.arena.auth.dto.EmailRequest;
import com.sidequest.arena.auth.dto.GoogleLoginRequest;
import com.sidequest.arena.auth.dto.LoginRequest;
import com.sidequest.arena.auth.dto.LogoutRequest;
import com.sidequest.arena.auth.dto.MeResponse;
import com.sidequest.arena.auth.dto.RefreshRequest;
import com.sidequest.arena.auth.dto.RegisterRequest;
import com.sidequest.arena.auth.dto.RegisterResponse;
import com.sidequest.arena.auth.dto.ResetPasswordRequest;
import com.sidequest.arena.auth.dto.VerifyEmailRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authentication endpoints: registration + email verification, login, refresh-token rotation, logout,
 * password reset, Google Sign-In and the current-session lookup. Registration no longer returns a
 * session — the account must verify its email first. Mounted under {@code /auth} (the global {@code /v1}
 * context path is applied by the server).
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** Registers a new account and emails a verification code; no session is issued until verified. */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(authService.register(request));
    }

    /** Confirms the email with its 6-digit code and returns the first token pair. */
    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        return ResponseEntity.ok(authService.verifyEmail(request));
    }

    /** Re-sends a verification code. Always 204 (never reveals whether the account exists). */
    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(@Valid @RequestBody EmailRequest request) {
        authService.resendVerification(request);
        return ResponseEntity.noContent().build();
    }

    /** Authenticates by email or phone + password and returns a fresh token pair. */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /** Verifies a Google id_token server-side and returns a fresh token pair. */
    @PostMapping("/google")
    public ResponseEntity<AuthResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        return ResponseEntity.ok(authService.loginWithGoogle(request));
    }

    /** Starts a password reset by emailing an OTP. Always 204 (no account enumeration). */
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody EmailRequest request) {
        authService.requestPasswordReset(request);
        return ResponseEntity.noContent().build();
    }

    /** Completes a password reset with its OTP + new password. Always 204; does not auto-login. */
    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }

    /** Rotates the presented refresh token and returns a fresh token pair. */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    /** Revokes the supplied refresh token, or all of the current user's tokens if none is given. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) LogoutRequest request) {
        authService.logout(request);
        return ResponseEntity.noContent().build();
    }

    /** Returns the authenticated user and their player profile (if any). */
    @GetMapping("/me")
    public ResponseEntity<MeResponse> me() {
        return ResponseEntity.ok(authService.me());
    }
}
