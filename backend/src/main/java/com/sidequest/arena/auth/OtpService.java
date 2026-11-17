package com.sidequest.arena.auth;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import com.sidequest.arena.common.Hashing;
import com.sidequest.arena.email.EmailSender;
import com.sidequest.arena.model.OtpCode;
import com.sidequest.arena.model.OtpPurpose;
import com.sidequest.arena.repo.OtpCodeRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/**
 * Issues and verifies 6-digit numeric one-time codes for email verification and password reset. Codes
 * are stored only as a SHA-256 hash (never plaintext), expire after a short TTL, are single-use, cap
 * verify attempts, and are rate-limited on issue (resend cooldown + hourly cap). Every failure returns
 * the same generic message so an attacker cannot distinguish wrong / expired / unknown-email.
 */
@Service
public class OtpService {

    private static final Duration TTL = Duration.ofMinutes(10);
    private static final int MAX_VERIFY_ATTEMPTS = 5;
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_SENDS_PER_HOUR = 5;
    private static final String GENERIC_FAILURE = "That code is invalid or has expired.";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpCodeRepository repository;
    private final EmailSender emailSender;

    public OtpService(OtpCodeRepository repository, EmailSender emailSender) {
        this.repository = repository;
        this.emailSender = emailSender;
    }

    /**
     * Generate, store (hashed) and email a fresh code for (email, purpose), THROWING on the send throttle.
     * Use this only where the caller (register / verify-email / reset-password) is acting on the caller's
     * OWN email, so a 429 is acceptable — never on an enumeration-safe endpoint.
     */
    @Transactional
    public void generate(String rawEmail, OtpPurpose purpose) {
        String email = normalize(rawEmail);
        Instant now = Instant.now();

        if (repository.countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(
                email, purpose, now.minus(RESEND_COOLDOWN)) > 0) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Please wait a moment before requesting another code.");
        }
        if (repository.countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(
                email, purpose, now.minus(Duration.ofHours(1))) >= MAX_SENDS_PER_HOUR) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many codes requested. Please try again later.");
        }
        issue(email, purpose, now);
    }

    /**
     * Like {@link #generate} but NEVER throws on the send throttle — it silently skips issuing a code when
     * one was recently sent. This keeps the enumeration-safe endpoints (resend-verification, forgot-password)
     * response-invariant: whether the account exists, is verified, or was just sent a code, the caller can
     * always return an identical 204. Throttle abuse control still comes from the outer per-email limiter.
     */
    @Transactional
    public void generateIfAllowed(String rawEmail, OtpPurpose purpose) {
        String email = normalize(rawEmail);
        Instant now = Instant.now();
        if (repository.countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(
                email, purpose, now.minus(RESEND_COOLDOWN)) > 0) {
            return; // recently sent — skip silently (no 429 to leak account existence)
        }
        if (repository.countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(
                email, purpose, now.minus(Duration.ofHours(1))) >= MAX_SENDS_PER_HOUR) {
            return; // hourly cap — skip silently
        }
        issue(email, purpose, now);
    }

    private void issue(String email, OtpPurpose purpose, Instant now) {
        repository.consumeOutstanding(email, purpose); // invalidate any prior live code

        String code = sixDigits();
        OtpCode otp = new OtpCode();
        otp.setEmail(email);
        otp.setPurpose(purpose);
        otp.setCodeHash(Hashing.sha256Hex(code));
        otp.setExpiresAt(now.plus(TTL));
        repository.save(otp);

        emailSender.send(email, subjectFor(purpose), bodyFor(purpose, code));
    }

    /** Verify + consume a code. Throws a generic error on any failure; returns quietly on success. */
    @Transactional
    public void verifyAndConsume(String rawEmail, OtpPurpose purpose, String code) {
        String email = normalize(rawEmail);
        OtpCode otp = repository
                .findTopByEmailIgnoreCaseAndPurposeAndConsumedFalseOrderByCreatedAtDesc(email, purpose)
                .orElseThrow(() -> new ApiException(ErrorCode.BAD_REQUEST, GENERIC_FAILURE));

        if (otp.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(ErrorCode.BAD_REQUEST, GENERIC_FAILURE);
        }
        if (otp.getAttempts() >= MAX_VERIFY_ATTEMPTS) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many attempts. Request a new code.");
        }

        boolean match = MessageDigest.isEqual(
                otp.getCodeHash().getBytes(StandardCharsets.UTF_8),
                Hashing.sha256Hex(code == null ? "" : code).getBytes(StandardCharsets.UTF_8));
        if (!match) {
            otp.setAttempts(otp.getAttempts() + 1);
            repository.save(otp);
            throw new ApiException(ErrorCode.BAD_REQUEST, GENERIC_FAILURE);
        }
        otp.setConsumed(true);
        repository.save(otp);
    }

    /** Hourly cleanup of expired codes so the table doesn't grow without bound. */
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void purgeExpired() {
        repository.deleteByExpiresAtBefore(Instant.now());
    }

    private static String sixDigits() {
        // Uniform over 100000..999999 — always 6 digits, no modulo bias.
        return Integer.toString(100_000 + RANDOM.nextInt(900_000));
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String subjectFor(OtpPurpose purpose) {
        return purpose == OtpPurpose.RESET_PASSWORD
                ? "Reset your SideQuests password"
                : "Verify your SideQuests email";
    }

    private static String bodyFor(OtpPurpose purpose, String code) {
        String action = purpose == OtpPurpose.RESET_PASSWORD ? "reset your password" : "verify your email";
        return "Your SideQuests Arena code to " + action + " is:\n\n    " + code
                + "\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.";
    }
}
