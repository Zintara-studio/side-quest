package com.sidequest.arena.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Arrays;

/**
 * Sends transactional email via SMTP when configured, otherwise logs it to the console (dev only).
 *
 * <p>Spring only auto-configures a {@link JavaMailSender} when {@code spring.mail.host} is set (which is
 * entirely env-driven), so a dev run with no SMTP env vars has no mail bean and this falls back to
 * logging the message — surfacing the OTP on the console for local testing. Outside the dev profile the
 * console fallback would silently dump OTPs/reset codes to stdout instead of delivering them, so a
 * non-dev boot without SMTP fails fast at startup. Delivery failures are swallowed-and-logged so email
 * deliverability can never be probed for account enumeration.
 */
@Service
public class EmailService implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final boolean smtpConfigured;
    private final String from;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                        @Value("${spring.mail.host:}") String mailHost,
                        @Value("${sidequest.mail.from:no-reply@sidequest.gg}") String from,
                        Environment env) {
        this.mailSenderProvider = mailSenderProvider;
        // Decide the fallback on the host VALUE, not on whether a JavaMailSender bean exists: Spring's
        // @ConditionalOnProperty treats an empty ${SMTP_HOST:} as "present" and auto-configures a broken
        // sender, so keying off the bean alone would try (and fail) to send in dev instead of logging.
        this.smtpConfigured = mailHost != null && !mailHost.isBlank();
        this.from = from;

        // Mirror JwtService's fail-fast: a production profile must never run on the console fallback.
        boolean devProfile = Arrays.asList(env.getActiveProfiles()).contains("dev");
        if (!devProfile && !smtpConfigured) {
            throw new IllegalStateException(
                    "SMTP_HOST (spring.mail.host) must be set when not running the dev profile — the "
                            + "console fallback would log OTPs/reset codes to stdout instead of sending them.");
        }
    }

    @Override
    public void send(String to, String subject, String body) {
        JavaMailSender mailSender = smtpConfigured ? mailSenderProvider.getIfAvailable() : null;
        if (mailSender == null) {
            // SMTP unconfigured (dev): log so the OTP is visible locally. Non-dev profiles fail fast at
            // startup when SMTP is unset, so this branch can only run in dev.
            log.info("[email:console-fallback] to={} | subject={}\n{}", to, subject, body);
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
        } catch (Exception ex) {
            // Never surface delivery state to callers (enumeration risk) — the user can resend.
            log.warn("Failed to send email to {}: {}", to, ex.getMessage());
        }
    }
}
