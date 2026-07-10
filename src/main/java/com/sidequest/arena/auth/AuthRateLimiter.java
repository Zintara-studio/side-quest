package com.sidequest.arena.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * NAT-safe auth abuse control.
 *
 * <p>On a shared campus/hostel network every player exits through the SAME public NAT IP, so IP-based
 * throttling would lock out the whole cohort the moment one of them retries. Instead we throttle by what
 * an attacker actually targets:
 * <ul>
 *   <li><b>Login</b> — capped per <em>identifier</em> (the email/phone being tried). This blunts
 *       credential-stuffing a specific account while never affecting anyone else on the same IP; a real
 *       user logs in well within the cap. Unknown identifiers never reach bcrypt (the service throws
 *       first), so this also bounds the login CPU cost.</li>
 *   <li><b>Register</b> — a single <em>global</em> cap, because register runs bcrypt on every call and an
 *       attacker can spray unique emails from one machine. Sized well above a legitimate onboarding rate
 *       so a real sign-up surge is fine, but a flood is throttled. (Durable spam is better solved by the
 *       planned email verification.)</li>
 * </ul>
 * Fixed one-minute windows. Disabled under the {@code dev} profile so local runs and the test suite are
 * never throttled.
 */
@Component
public class AuthRateLimiter {

    /** Max login attempts per identifier per minute. A human needs 1–2; an attacker is capped hard. */
    private static final int LOGIN_ATTEMPTS_PER_MINUTE = 10;
    /** Global registrations per minute — a bcrypt-DoS backstop, far above real onboarding rates. */
    private static final int REGISTER_PER_MINUTE = 60;
    /** Per-email OTP verify attempts/min — a brute-force backstop layered on OtpService's per-code cap. */
    private static final int OTP_VERIFY_PER_MINUTE = 15;
    /** Per-email OTP (re)send/min — layered on OtpService's 60s cooldown + hourly cap. */
    private static final int OTP_RESEND_PER_MINUTE = 5;

    private final boolean enabled;

    private final Cache<String, AtomicInteger> loginByIdentifier = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1))
            .maximumSize(100_000)
            .build();

    private final Cache<String, AtomicInteger> registerWindow = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1))
            .maximumSize(4)
            .build();

    private final Cache<String, AtomicInteger> otpVerifyByEmail = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1))
            .maximumSize(100_000)
            .build();

    private final Cache<String, AtomicInteger> otpResendByEmail = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1))
            .maximumSize(100_000)
            .build();

    public AuthRateLimiter(Environment env) {
        this.enabled = !env.acceptsProfiles(Profiles.of("dev"));
    }

    /** Throttle sign-in attempts for one account (identifier), independent of source IP. */
    public void checkLogin(String identifier) {
        if (!enabled || identifier == null || identifier.isBlank()) {
            return;
        }
        String key = identifier.trim().toLowerCase();
        if (loginByIdentifier.get(key, k -> new AtomicInteger()).incrementAndGet() > LOGIN_ATTEMPTS_PER_MINUTE) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Too many sign-in attempts for this account. Please wait a minute and try again.");
        }
    }

    /** Global throttle on account creation to bound bcrypt CPU under a flood. */
    public void checkRegister() {
        if (!enabled) {
            return;
        }
        if (registerWindow.get("all", k -> new AtomicInteger()).incrementAndGet() > REGISTER_PER_MINUTE) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Sign-ups are busy right now. Please wait a minute and try again.");
        }
    }

    /** Throttle OTP verification attempts per email (brute-force backstop), independent of source IP. */
    public void checkOtpVerify(String email) {
        if (!enabled || email == null || email.isBlank()) {
            return;
        }
        String key = email.trim().toLowerCase();
        if (otpVerifyByEmail.get(key, k -> new AtomicInteger()).incrementAndGet() > OTP_VERIFY_PER_MINUTE) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Too many attempts for this account. Please wait a minute and try again.");
        }
    }

    /** Throttle OTP (re)send requests per email, independent of source IP. */
    public void checkOtpResend(String email) {
        if (!enabled || email == null || email.isBlank()) {
            return;
        }
        String key = email.trim().toLowerCase();
        if (otpResendByEmail.get(key, k -> new AtomicInteger()).incrementAndGet() > OTP_RESEND_PER_MINUTE) {
            throw new ApiException(ErrorCode.RATE_LIMITED,
                    "Too many requests for this account. Please wait a minute and try again.");
        }
    }
}
