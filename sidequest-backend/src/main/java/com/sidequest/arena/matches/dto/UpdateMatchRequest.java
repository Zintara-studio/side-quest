package com.sidequest.arena.matches.dto;

import com.sidequest.arena.model.MatchStatus;

import java.time.Instant;

/**
 * Admin patch for a fixture. All fields are optional; only non-null fields are applied.
 *
 * @param scheduledAt new schedule, when set
 * @param status      new status, when set
 * @param arena       new venue, when set
 * @param format      new format, when set
 */
public record UpdateMatchRequest(
        Instant scheduledAt,
        MatchStatus status,
        String arena,
        String format
) {
}
