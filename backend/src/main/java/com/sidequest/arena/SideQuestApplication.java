package com.sidequest.arena;

import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.Arrays;

/**
 * Side Quest league platform — modular REST API.
 *
 * <p>Implements the "Side Quest Backend Architecture" reference: a REST API behind a gateway,
 * a realtime channel for live matches, async workers for scoring &amp; notifications, backed by
 * Postgres (source of truth) + Redis-style cache + object storage. The player app and admin
 * panel share the same API surface, separated by role.</p>
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class SideQuestApplication {

    public static void main(String[] args) {
        SpringApplication.run(SideQuestApplication.class, args);
    }

    /**
     * Loud, unmissable banner when the DEV profile is live: in-memory H2, schema recreated on every
     * boot, demo data with committed passwords. An unconfigured deploy defaults to this profile, so a
     * prod box that forgot {@code SPRING_PROFILES_ACTIVE=postgres} announces itself in the first lines
     * of the log instead of silently serving demo credentials.
     */
    @Bean
    ApplicationRunner devProfileWarning(Environment env) {
        return args -> {
            if (Arrays.asList(env.getActiveProfiles()).contains("dev")) {
                LoggerFactory.getLogger(SideQuestApplication.class).warn(
                        "RUNNING THE DEV PROFILE: in-memory H2 (data lost on restart) + seeded demo "
                                + "accounts with committed passwords. NOT for production — set "
                                + "SPRING_PROFILES_ACTIVE=postgres for a real deployment.");
            }
        };
    }
}
