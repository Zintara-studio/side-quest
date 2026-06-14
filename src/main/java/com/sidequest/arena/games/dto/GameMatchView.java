package com.sidequest.arena.games.dto;

import java.time.Instant;

/**
 * Lightweight projection of a recent fixture for a game's detail page: when it is scheduled, its
 * lifecycle status and the arena it is played in.
 */
public record GameMatchView(
        String matchId,
        Instant scheduledAt,
        String status,
        String arena
) {
}
