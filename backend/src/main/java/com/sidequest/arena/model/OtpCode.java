package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A one-time 6-digit numeric code for email verification or password reset. Only a hash of the code is
 * stored (never the plaintext); a code expires, is single-use ({@code consumed}) and caps verify attempts.
 */
@Entity
@Table(name = "otp_codes", indexes = {
        @Index(name = "idx_otp_email_purpose", columnList = "email, purpose")
})
@Getter
@Setter
@NoArgsConstructor
public class OtpCode extends BaseEntity {

    /** Target email, stored trimmed + lowercased. */
    @Column(nullable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OtpPurpose purpose;

    /** SHA-256 hex of the 6-digit code — the plaintext is never persisted. */
    @Column(name = "code_hash", nullable = false, length = 128)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private boolean consumed = false;

    @Column(nullable = false)
    private int attempts = 0;
}
