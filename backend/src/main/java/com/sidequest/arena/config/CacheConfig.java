package com.sidequest.arena.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * In-process read cache (Caffeine) for the hottest public read paths — the homepage and browse
 * pages (standings, leaderboards, games, franchises, players). These are read far more often than
 * they change, and recomputing standings / running list queries on every request was the main
 * source of latency.
 *
 * <p>Strategy (see docs/caching-hld.md): short TTL ({@value #TTL_SECONDS}s) so any staleness
 * self-heals quickly, plus explicit eviction on the writes that change this data (result entry →
 * standings recompute, game edits). Per-user / mutating endpoints are intentionally NOT cached.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String GAMES = "games";
    public static final String STANDINGS = "standings";
    public static final String LEADERBOARD_PLAYERS = "leaderboard-players";
    public static final String GAME_RANKINGS = "game-rankings";
    public static final String FRANCHISES = "franchises";
    public static final String PLAYERS = "players";

    public static final int TTL_SECONDS = 45;

    @Bean
    public CaffeineCacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
                GAMES, STANDINGS, LEADERBOARD_PLAYERS, GAME_RANKINGS, FRANCHISES, PLAYERS);
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(TTL_SECONDS))
                .maximumSize(500));
        return manager;
    }
}
