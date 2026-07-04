package com.sidequest.arena.games.dto;

import com.sidequest.arena.model.GameType;

/**
 * Admin patch for a game. All fields are optional; only non-null fields are applied. {@code enabled}
 * toggles visibility, {@code popularity} drives the popularity bars, {@code format}/{@code iconUrl}
 * update presentation, and {@code gameType} reclassifies the title's genre. (Registration windows are
 * opened per announcement, not per game.)
 */
public record UpdateGameRequest(
        Boolean enabled,
        Integer popularity,
        String format,
        String iconUrl,
        GameType gameType
) {
}
