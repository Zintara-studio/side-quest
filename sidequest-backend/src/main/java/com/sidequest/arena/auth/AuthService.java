package com.sidequest.arena.auth;

import com.sidequest.arena.auth.dto.AuthResponse;
import com.sidequest.arena.auth.dto.LoginRequest;
import com.sidequest.arena.auth.dto.LogoutRequest;
import com.sidequest.arena.auth.dto.MeResponse;
import com.sidequest.arena.auth.dto.RefreshRequest;
import com.sidequest.arena.auth.dto.RegisterRequest;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.RefreshToken;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RefreshTokenRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.JwtService;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Authentication and session management: registration, login, refresh-token rotation, logout and
 * the current-session lookup. Access tokens are short-lived JWTs; refresh tokens are opaque random
 * secrets persisted only as SHA-256 hashes and rotated on every refresh.
 */
@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int REFRESH_TOKEN_BYTES = 32;

    private final UserRepository userRepository;
    private final PlayerRepository playerRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       PlayerRepository playerRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.playerRepository = playerRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    /** Registers a new PLAYER user plus a PENDING player profile and issues a fresh token pair. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ApiException(ErrorCode.EMAIL_TAKEN, "Email already registered");
        }

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setRole(Role.PLAYER);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user = userRepository.save(user);

        Player player = new Player();
        player.setUser(user);
        player.setGamerTag(request.name());
        player.setStatus(PlayerStatus.PENDING);
        playerRepository.save(player);

        return issueTokens(user);
    }

    /** Authenticates by email or phone + password and issues a fresh token pair. */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.identifier())
                .or(() -> userRepository.findByPhone(request.identifier()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials");
        }

        return issueTokens(user);
    }

    /** Validates and rotates the presented refresh token, returning a fresh token pair. */
    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        String hash = sha256Hex(request.refreshToken());
        RefreshToken token = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.TOKEN_INVALID, "Refresh token is invalid"));

        if (token.isRevoked() || token.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(ErrorCode.TOKEN_INVALID, "Refresh token is invalid");
        }

        // Rotate: revoke the presented token before minting a replacement.
        token.setRevoked(true);
        refreshTokenRepository.save(token);

        return issueTokens(token.getUser());
    }

    /**
     * Revokes the supplied refresh token if present; otherwise revokes every refresh token for the
     * authenticated user. Silently no-ops if a supplied token cannot be found.
     */
    @Transactional
    public void logout(LogoutRequest request) {
        String rawToken = request == null ? null : request.refreshToken();
        if (rawToken != null && !rawToken.isBlank()) {
            refreshTokenRepository.findByTokenHash(sha256Hex(rawToken)).ifPresent(token -> {
                token.setRevoked(true);
                refreshTokenRepository.save(token);
            });
            return;
        }
        refreshTokenRepository.revokeAllForUser(SecurityUtils.currentUserId());
    }

    /** Returns the authenticated user and (optional) player profile for the current session. */
    @Transactional(readOnly = true)
    public MeResponse me() {
        UUID userId = SecurityUtils.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Authentication required"));

        MeResponse.UserView userView = new MeResponse.UserView(
                user.getId().toString(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole().name());

        MeResponse.PlayerView playerView = playerRepository.findByUserId(userId)
                .map(player -> new MeResponse.PlayerView(
                        player.getId().toString(),
                        player.getGamerTag(),
                        player.getAvatarUrl(),
                        player.getStatus().name(),
                        player.getPoints(),
                        player.getFranchise() == null ? null : player.getFranchise().getId().toString()))
                .orElse(null);

        return new MeResponse(userView, playerView);
    }

    // ---- helpers ----

    /**
     * Mints a new access token and a new (persisted) rotating refresh token for the given user,
     * returning the raw refresh secret to the caller.
     */
    private AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole());
        String rawRefreshToken = newRawRefreshToken();

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(sha256Hex(rawRefreshToken));
        refreshToken.setExpiresAt(Instant.now().plusSeconds(jwtService.getRefreshTokenTtlSeconds()));
        refreshToken.setRevoked(false);
        refreshTokenRepository.save(refreshToken);

        AuthResponse.UserView userView = new AuthResponse.UserView(
                user.getId().toString(),
                user.getName(),
                user.getEmail(),
                user.getRole().name());

        return new AuthResponse(
                accessToken,
                rawRefreshToken,
                "Bearer",
                jwtService.getAccessTokenTtlSeconds(),
                userView);
    }

    /** Generates a cryptographically random, base64url-encoded refresh secret. */
    private static String newRawRefreshToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Computes the lowercase hex SHA-256 digest of the given value. */
    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed available on every JVM.
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }
}
