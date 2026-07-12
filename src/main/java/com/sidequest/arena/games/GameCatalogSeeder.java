package com.sidequest.arena.games;

import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.GameType;
import com.sidequest.arena.repo.GameRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * The canonical, static games catalogue and its idempotent seeding. A fresh production database has no
 * games — nothing else the league needs is static config (seasons/matches/etc. are operational) — so this
 * is the one thing that must exist for a usable league. Run automatically on the first boot of a non-dev
 * profile ({@code GameCatalogBootstrap}) and on-demand via {@code POST /admin/seed}.
 */
@Service
public class GameCatalogSeeder {

    /** name, format, genre, popularity, enabled. */
    private record Title(String name, String format, GameType type, int popularity, boolean enabled) {
    }

    private static final List<Title> CATALOG = List.of(
            new Title("Valorant", "5v5 Tactical", GameType.TACTICAL, 96, true),
            new Title("BGMI", "Battle Royale · Squads", GameType.BATTLE_ROYALE, 91, true),
            new Title("CS2", "5v5 Tactical", GameType.TACTICAL, 84, true),
            new Title("Free Fire", "Battle Royale · Squads", GameType.BATTLE_ROYALE, 78, true),
            new Title("COD", "Battle Royale · Mobile", GameType.BATTLE_ROYALE, 74, true),
            new Title("Marvel Rivals", "6v6 Hero Shooter", GameType.TACTICAL, 70, true),
            new Title("Smashkarts", "Free-for-all · 1v1", GameType.PARTY, 67, true),
            new Title("FIFA", "1v1 · Sports", GameType.SPORTS, 62, true),
            new Title("Brawlhalla", "Platform Fighter", GameType.FIGHTING, 45, true));

    private final GameRepository gameRepository;

    public GameCatalogSeeder(GameRepository gameRepository) {
        this.gameRepository = gameRepository;
    }

    /**
     * Insert any catalogue title not already present (case-insensitive on name). Idempotent — safe to
     * call repeatedly and on any profile. Returns how many were created.
     */
    @CacheEvict(value = CacheConfig.GAMES, allEntries = true)
    @Transactional
    public int seedGames() {
        int created = 0;
        for (Title t : CATALOG) {
            if (!gameRepository.existsByNameIgnoreCase(t.name())) {
                gameRepository.save(buildGame(t.name(), t.format(), t.type(), t.popularity(), t.enabled()));
                created++;
            }
        }
        return created;
    }

    /**
     * Build a {@link Game} with genre-derived scoring defaults — the single source of those defaults,
     * shared by this seeder and admin create-game so they never drift. Kills weighted 1, the genre's
     * default placement ladder, and a 1.00× standings weight (party/casual titles seeded a touch lighter).
     */
    public static Game buildGame(String name, String format, GameType type, int popularity, boolean enabled) {
        Game g = new Game();
        g.setName(name);
        g.setFormat(format);
        g.setGameType(type);
        g.setPopularity(Math.max(0, Math.min(100, popularity)));
        g.setEnabled(enabled);
        g.setPointsPerKill(1);
        g.setPlacementPoints(type.defaultPlacementPoints());
        g.setStandingsWeight(type == GameType.PARTY ? 75 : 100);
        return g;
    }
}
