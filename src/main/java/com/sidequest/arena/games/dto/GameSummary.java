package com.sidequest.arena.games.dto;

/**
 * Compact view of a supported title for the games grid: identity, format, visibility/registration
 * flags and the popularity score that backs the popularity bars.
 */
public record GameSummary(
        String id,
        String name,
        String format,
        String iconUrl,
        boolean enabled,
        boolean regOpen,
        int popularity
) {
}
