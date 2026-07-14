package com.sidequest.arena.games.dto;

import com.sidequest.arena.model.GameType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Admin create-game payload. Scoring (points/kill, placement ladder, standings weight) is defaulted from
 * the genre — admins tune it afterwards via {@code PATCH /games/{id}} (weight changes stay main-admin-only).
 *
 * <p>Popularity is intentionally absent — it is community-vote-driven (see {@code GameVoteService}), so
 * a new title starts at 0 and rises as players upvote it; it is never set by an admin.
 *
 * @param name     the title's display name, unique site-wide
 * @param format   short format label (e.g. "5v5 Tactical")
 * @param gameType genre (drives result-entry flow + default scoring)
 * @param iconUrl  optional icon reference
 */
public record CreateGameRequest(
        @NotBlank String name,
        @NotBlank String format,
        @NotNull GameType gameType,
        String iconUrl
) {
}
