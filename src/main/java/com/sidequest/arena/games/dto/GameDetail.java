package com.sidequest.arena.games.dto;

import java.util.List;

/**
 * Full title detail: the game's fields plus its recent matches (newest first).
 */
public record GameDetail(
        String id,
        String name,
        String format,
        String iconUrl,
        boolean enabled,
        int popularity,
        List<GameMatchView> matches
) {
}
