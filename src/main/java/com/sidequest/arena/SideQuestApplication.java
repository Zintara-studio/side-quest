package com.sidequest.arena;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

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
public class SideQuestApplication {

    public static void main(String[] args) {
        SpringApplication.run(SideQuestApplication.class, args);
    }
}
