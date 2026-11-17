package com.sidequest.arena.config;

import com.sidequest.arena.model.AdminLevel;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bootstraps the single <strong>main admin</strong> (super-admin) on any profile so a fresh production
 * database is never left with no way in (the demo seeder is dev-only). Controlled entirely by env:
 *
 * <ul>
 *   <li>{@code SIDEQUEST_SUPER_ADMIN_EMAIL} — the main admin's email (required to do anything)</li>
 *   <li>{@code SIDEQUEST_SUPER_ADMIN_PASSWORD} — first-login password (required only when the account
 *       doesn't exist yet)</li>
 *   <li>{@code SIDEQUEST_SUPER_ADMIN_NAME} — display name (optional)</li>
 * </ul>
 *
 * <p>Idempotent and singleton-safe: it does nothing once a {@code SUPER_ADMIN} exists. If the named
 * account already exists it is promoted (and email-verified); otherwise it is created. There is exactly
 * one main admin — appointing/revoking regular admins is done in-app by that account.
 */
@Component
public class BootstrapAdminRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;
    private final String name;

    public BootstrapAdminRunner(UserRepository userRepository,
                                PasswordEncoder passwordEncoder,
                                @Value("${SIDEQUEST_SUPER_ADMIN_EMAIL:}") String email,
                                @Value("${SIDEQUEST_SUPER_ADMIN_PASSWORD:}") String password,
                                @Value("${SIDEQUEST_SUPER_ADMIN_NAME:League Admin}") String name) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
        this.name = name;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank()) {
            return; // no bootstrap configured (e.g. dev, where the seeder provides the admin)
        }
        // Singleton main admin: if one already exists, leave everything alone.
        if (userRepository.existsByAdminLevel(AdminLevel.SUPER_ADMIN)) {
            return;
        }

        User existing = userRepository.findByEmailIgnoreCase(email.trim()).orElse(null);
        if (existing != null) {
            existing.setAdminLevel(AdminLevel.SUPER_ADMIN);
            existing.setEmailVerified(true);
            userRepository.save(existing);
            log.warn("Bootstrap: promoted existing account {} to the main admin (SUPER_ADMIN).", email);
            return;
        }

        if (password == null || password.isBlank()) {
            log.error("Bootstrap: SIDEQUEST_SUPER_ADMIN_EMAIL is set to a NEW account ({}) but "
                    + "SIDEQUEST_SUPER_ADMIN_PASSWORD is empty — cannot create the main admin. Set a "
                    + "password (or point the email at an existing account).", email);
            return;
        }

        User admin = new User();
        admin.setName(name == null || name.isBlank() ? "League Admin" : name.trim());
        admin.setEmail(email.trim());
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(Role.ADMIN);            // identity role; admin power comes from adminLevel
        admin.setAdminLevel(AdminLevel.SUPER_ADMIN);
        admin.setEmailVerified(true);
        userRepository.save(admin);
        log.warn("Bootstrap: created the main admin account {} (SUPER_ADMIN). Change the password after "
                + "first login.", email);
    }
}
