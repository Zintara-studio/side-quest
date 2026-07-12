package com.sidequest.arena.auth;

import com.sidequest.arena.auth.dto.AuthResponse;
import com.sidequest.arena.auth.dto.LoginRequest;
import com.sidequest.arena.auth.dto.LogoutRequest;
import com.sidequest.arena.auth.dto.MeResponse;
import com.sidequest.arena.auth.dto.RefreshRequest;
import com.sidequest.arena.auth.dto.RegisterRequest;
import com.sidequest.arena.auth.dto.RegisterResponse;
import com.sidequest.arena.auth.dto.VerifyEmailRequest;
import com.sidequest.arena.auth.dto.EmailRequest;
import com.sidequest.arena.auth.dto.ResetPasswordRequest;
import com.sidequest.arena.auth.dto.GoogleLoginRequest;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import com.sidequest.arena.model.OtpPurpose;
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
import org.springframework.scheduling.annotation.Scheduled;
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
    private final AuthRateLimiter rateLimiter;
    private final OtpService otpService;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthService(UserRepository userRepository,
                       PlayerRepository playerRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder,
                       AuthRateLimiter rateLimiter,
                       OtpService otpService,
                       GoogleTokenVerifier googleTokenVerifier) {
        this.userRepository = userRepository;
        this.playerRepository = playerRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiter = rateLimiter;
        this.otpService = otpService;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    /**
     * Registers a new PLAYER account (UNVERIFIED) plus a PENDING player profile and emails a 6-digit
     * verification code. NO session is issued here — the account must verify its email first
     * ({@link #verifyEmail}), which stops mass fake sign-ups from ever producing a usable account.
     */
    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        rateLimiter.checkRegister();
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ApiException(ErrorCode.EMAIL_TAKEN, "Email already registered");
        }
        // The display name doubles as the public gamerTag/username, which must be unique site-wide.
        if (playerRepository.existsByGamerTagIgnoreCase(request.name())) {
            throw ApiException.conflict("That display name is already taken — pick another.");
        }

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setRole(Role.PLAYER);
        user.setEmailVerified(false);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user = userRepository.save(user);

        Player player = new Player();
        player.setUser(user);
        player.setGamerTag(request.name());
        player.setStatus(PlayerStatus.PENDING);
        playerRepository.save(player);

        otpService.generate(user.getEmail(), OtpPurpose.VERIFY_EMAIL);
        return new RegisterResponse(user.getEmail(), true);
    }

    /**
     * Confirms a new account's email with its OTP: marks the user verified, promotes their Player to
     * VERIFIED (auction-eligible), and issues the first session.
     */
    @Transactional
    public AuthResponse verifyEmail(VerifyEmailRequest request) {
        rateLimiter.checkOtpVerify(request.email());
        otpService.verifyAndConsume(request.email(), OtpPurpose.VERIFY_EMAIL, request.code());

        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new ApiException(ErrorCode.BAD_REQUEST, "That code is invalid or has expired."));
        user.setEmailVerified(true);
        userRepository.save(user);
        promoteToVerified(user);

        ensureNotSuspended(user);
        return issueTokens(user);
    }

    /** Re-sends a verification code. Always succeeds silently (no account enumeration). */
    @Transactional
    public void resendVerification(EmailRequest request) {
        rateLimiter.checkOtpResend(request.email());
        userRepository.findByEmailIgnoreCase(request.email())
                .filter(u -> !u.isEmailVerified())
                .ifPresent(u -> otpService.generateIfAllowed(u.getEmail(), OtpPurpose.VERIFY_EMAIL));
    }

    /** Starts a password reset by emailing an OTP. Always succeeds silently (no account enumeration). */
    @Transactional
    public void requestPasswordReset(EmailRequest request) {
        rateLimiter.checkOtpResend(request.email());
        userRepository.findByEmailIgnoreCase(request.email())
                .ifPresent(u -> otpService.generateIfAllowed(u.getEmail(), OtpPurpose.RESET_PASSWORD));
    }

    /**
     * Completes a password reset with its OTP: sets the new password and revokes ALL of the user's
     * refresh tokens (cuts off any compromised session). Does not auto-login — the user signs in fresh.
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        rateLimiter.checkOtpVerify(request.email());
        otpService.verifyAndConsume(request.email(), OtpPurpose.RESET_PASSWORD, request.code());

        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new ApiException(ErrorCode.BAD_REQUEST, "That code is invalid or has expired."));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        // A successful reset also proves email control — verify + promote if not already.
        if (!user.isEmailVerified()) {
            user.setEmailVerified(true);
            promoteToVerified(user);
        }
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId());
    }

    /**
     * Google Sign-In: verifies the id_token server-side, upserts a verified User + Player, and issues the
     * same session a password login would. Google-created users get a random, un-guessable password hash
     * so the password path can never authenticate them.
     */
    @Transactional
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        GoogleTokenVerifier.GoogleIdentity identity = googleTokenVerifier.verify(request.idToken());
        if (!identity.emailVerified() || identity.email() == null || identity.email().isBlank()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Google account email is not verified");
        }

        User user = userRepository.findByEmailIgnoreCase(identity.email()).orElse(null);
        if (user == null) {
            user = new User();
            user.setName(identity.name() != null ? identity.name() : identity.email());
            user.setEmail(identity.email());
            user.setRole(Role.PLAYER);
            user.setEmailVerified(true);
            user.setPasswordHash(passwordEncoder.encode(newRawRefreshToken())); // random, unusable password
            user = userRepository.save(user);

            Player player = new Player();
            player.setUser(user);
            // A Google user can't be re-prompted for a name, so auto-suffix on collision rather than fail.
            player.setGamerTag(uniqueGamerTag(user.getName()));
            player.setStatus(PlayerStatus.VERIFIED); // Google verified the email → auction-eligible
            playerRepository.save(player);
        } else if (!user.isEmailVerified()) {
            // Google just proved ownership of a previously-UNVERIFIED account. Invalidate any password an
            // attacker may have pre-set on it (account pre-hijacking) by overwriting with a random unusable
            // hash; the legitimate owner can set a real password later via the reset-password flow.
            user.setEmailVerified(true);
            user.setPasswordHash(passwordEncoder.encode(newRawRefreshToken()));
            userRepository.save(user);
            promoteToVerified(user);
        }

        ensureNotSuspended(user);
        return issueTokens(user);
    }

    /** Authenticates by email or phone + password and issues a fresh token pair. */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        rateLimiter.checkLogin(request.identifier());
        User user = userRepository.findByEmailIgnoreCase(request.identifier())
                .or(() -> userRepository.findByPhone(request.identifier()))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials");
        }

        if (!user.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, "Please verify your email before signing in.");
        }
        ensureNotSuspended(user);
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

        if (!token.getUser().isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, "Please verify your email before signing in.");
        }
        ensureNotSuspended(token.getUser());

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
                user.getRole().name(),
                user.getAdminLevel().name());

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

    /** Hourly cleanup of expired refresh tokens so the table doesn't grow without bound. */
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void purgeExpiredRefreshTokens() {
        refreshTokenRepository.deleteExpiredBefore(Instant.now());
    }

    // ---- helpers ----

    /**
     * Email verification is the platform's verification step: promote a PENDING player to VERIFIED
     * (auction/franchise-eligible). No-op if they were already promoted, flagged or suspended.
     */
    private void promoteToVerified(User user) {
        playerRepository.findByUserId(user.getId())
                .filter(player -> player.getStatus() == PlayerStatus.PENDING)
                .ifPresent(player -> {
                    player.setStatus(PlayerStatus.VERIFIED);
                    playerRepository.save(player);
                });
    }

    /**
     * A gamerTag unique site-wide, derived from {@code base}: returns it as-is when free, else appends a
     * numeric discriminator ("Alex" → "Alex2" → "Alex3"). Used for SSO sign-ups where the user can't be
     * re-prompted; the DB unique index backstops the (rare) race.
     */
    private String uniqueGamerTag(String base) {
        String candidate = base;
        int n = 1;
        while (playerRepository.existsByGamerTagIgnoreCase(candidate)) {
            candidate = base + (++n);
        }
        return candidate;
    }

    /** Blocks a suspended player from acquiring or renewing a session. */
    private void ensureNotSuspended(User user) {
        playerRepository.findByUserId(user.getId())
                .filter(player -> player.getStatus() == PlayerStatus.SUSPENDED)
                .ifPresent(player -> {
                    throw new ApiException(ErrorCode.FORBIDDEN, "This account has been suspended");
                });
    }

    /**
     * Mints a new access token and a new (persisted) rotating refresh token for the given user,
     * returning the raw refresh secret to the caller.
     */
    private AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole(), user.getAdminLevel());
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
                user.getRole().name(),
                user.getAdminLevel().name());

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
