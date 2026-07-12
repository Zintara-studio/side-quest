package com.sidequest.arena.config;

import com.sidequest.arena.games.GameCatalogSeeder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Seeds the static games catalogue on the first boot of a real (non-dev) deployment, so a fresh
 * production database comes up with a usable set of titles instead of empty. Idempotent (the seeder
 * skips titles that already exist), so it's a no-op on every boot after the first.
 *
 * <p>{@code @Profile("!dev")} because the dev {@code DataSeeder} already inserts the catalogue
 * unconditionally, and running both would violate the unique game-name constraint.
 */
@Component
@Profile("!dev")
public class GameCatalogBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(GameCatalogBootstrap.class);

    private final GameCatalogSeeder seeder;

    public GameCatalogBootstrap(GameCatalogSeeder seeder) {
        this.seeder = seeder;
    }

    @Override
    public void run(ApplicationArguments args) {
        int created = seeder.seedGames();
        if (created > 0) {
            log.info("Seeded {} default game(s) into an empty catalogue.", created);
        }
    }
}
