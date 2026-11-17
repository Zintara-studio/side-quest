package com.sidequest.arena.seasons.dto;

import java.time.Instant;

/**
 * A season as returned to clients.
 *
 * @param code      stable season code (e.g. "S04"), used as the seasonId across the app
 * @param name      display name (e.g. "Season 04 — Spring")
 * @param status    ACTIVE or FINISHED
 * @param current   whether this is the active season
 * @param startedAt when the season began (nullable)
 * @param endedAt   when the season ended (nullable; null while active)
 */
public record SeasonView(
        String code,
        String name,
        String status,
        boolean current,
        Instant startedAt,
        Instant endedAt
) {
}
