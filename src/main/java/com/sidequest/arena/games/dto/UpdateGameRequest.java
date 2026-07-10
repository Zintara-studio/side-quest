package com.sidequest.arena.games.dto;

import com.sidequest.arena.model.GameType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Admin patch for a game. All fields are optional; only non-null fields are applied. {@code enabled}
 * toggles visibility, {@code popularity} drives the popularity bars, {@code format}/{@code iconUrl}
 * update presentation, {@code gameType} reclassifies the genre, and {@code pointsPerKill} /
 * {@code placementPoints} / {@code standingsWeight} configure this title's system-wide scoring.
 * (Registration windows are opened per announcement, not per game.)
 *
 * <p>The scoring fields carry upper bounds so an out-of-range value is a clean 400 rather than silent
 * arithmetic overflow when the standings engine weights and sums result rows.
 *
 * @param pointsPerKill   new points-per-kill (optional; 0–1000)
 * @param placementPoints new placement ladder (optional; comma-separated integers, or "" for none)
 * @param standingsWeight new standings weight in basis points (optional; 100 = 1.00×, 0–10000)
 */
public record UpdateGameRequest(
        Boolean enabled,
        Integer popularity,
        String format,
        String iconUrl,
        GameType gameType,
        @Min(0) @Max(1000) Integer pointsPerKill,
        String placementPoints,
        @Min(0) @Max(10000) Integer standingsWeight
) {
}
