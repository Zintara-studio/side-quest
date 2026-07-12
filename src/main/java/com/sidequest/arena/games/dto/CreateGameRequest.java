package com.sidequest.arena.games.dto;

import com.sidequest.arena.model.GameType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Admin create-game payload. Scoring (points/kill, placement ladder, standings weight) is defaulted from
 * the genre — admins tune it afterwards via {@code PATCH /games/{id}} (weight changes stay main-admin-only).
 *
 * @param name       the title's display name, unique site-wide
 * @param format     short format label (e.g. "5v5 Tactical")
 * @param gameType   genre (drives result-entry flow + default scoring)
 * @param popularity 0–100 popularity for the grid bars (nullable → 0)
 * @param iconUrl    optional icon reference
 */
public record CreateGameRequest(
        @NotBlank String name,
        @NotBlank String format,
        @NotNull GameType gameType,
        Integer popularity,
        String iconUrl
) {
}
