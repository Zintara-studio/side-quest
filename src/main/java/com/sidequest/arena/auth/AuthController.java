package com.sidequest.arena.auth;

import com.sidequest.arena.auth.dto.AuthResponse;
import com.sidequest.arena.auth.dto.LoginRequest;
import com.sidequest.arena.auth.dto.LogoutRequest;
import com.sidequest.arena.auth.dto.MeResponse;
import com.sidequest.arena.auth.dto.RefreshRequest;
import com.sidequest.arena.auth.dto.RegisterRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authentication endpoints: registration, login, refresh-token rotation, logout and the
 * current-session lookup. Mounted under {@code /auth} (the global {@code /v1} context path is
 * applied by the server).
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** Registers a new player account and returns a fresh token pair. */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    /** Authenticates by email or phone + password and returns a fresh token pair. */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
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
