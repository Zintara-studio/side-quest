package com.sidequest.arena.security;

import com.sidequest.arena.model.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
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

    private final JwtProperties props;
    private final SecretKey key;

    public JwtService(JwtProperties props) {
        this.props = props;
        this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
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
