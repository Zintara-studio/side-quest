package com.sidequest.arena.security;

import com.sidequest.arena.model.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and validates short-lived JWT access tokens (15 min) and opaque-style refresh token ids.
 * Refresh tokens themselves are persisted/rotated by the auth service; this class only signs the
 * access token and a random refresh secret.
 */
@Service
public class JwtService {

    /** The committed dev-only secret; rejected outside the dev profile so prod can't silently use it. */
    private static final String DEV_DEFAULT_SECRET =
            "change-me-in-prod-this-is-a-very-long-dev-only-secret-key-0123456789";

    private final JwtProperties props;
    private final SecretKey key;

    public JwtService(JwtProperties props, Environment env) {
        String secret = props.getSecret();
        boolean devProfile = java.util.Arrays.asList(env.getActiveProfiles()).contains("dev");
        if (!devProfile && (secret == null || secret.isBlank() || DEV_DEFAULT_SECRET.equals(secret))) {
            throw new IllegalStateException(
                    "SIDEQUEST_JWT_SECRET must be set to a strong, non-default secret when not running the dev profile");
        }
        if (DEV_DEFAULT_SECRET.equals(secret)) {
            // Loud reminder: an unconfigured launch defaults to the dev profile + this committed secret. Safe
            // for local dev only — a public deploy MUST set SPRING_PROFILES_ACTIVE=postgres + SIDEQUEST_JWT_SECRET.
            LoggerFactory.getLogger(JwtService.class).warn(
                    "SECURITY: signing JWTs with the COMMITTED dev-only secret. Do NOT expose this instance "
                    + "publicly — set SPRING_PROFILES_ACTIVE=postgres and a strong SIDEQUEST_JWT_SECRET for deploy.");
        }
        this.props = props;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(UUID userId, String email, Role role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(props.getIssuer())
                .subject(userId.toString())
                .claim("email", email)
                .claim("role", role.name())
                .claim("typ", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(props.getAccessTokenTtlSeconds())))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(props.getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getAccessTokenTtlSeconds() {
        return props.getAccessTokenTtlSeconds();
    }

    public long getRefreshTokenTtlSeconds() {
        return props.getRefreshTokenTtlSeconds();
    }
}
