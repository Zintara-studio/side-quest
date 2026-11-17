package com.sidequest.arena.admin.dto;

import java.time.Instant;

/**
 * Read model for the singleton league settings. Scoring is configured per-game (not league-wide), so
 * it is no longer part of settings.
 *
 * @param seasonId               current season identifier
 * @param seasonName             human-readable season name
 * @param registrationLockHours  hours before a match that its registration locks
 * @param updatedAt              when the settings were last changed
 */
public record SettingsView(
        String seasonId,
        String seasonName,
        int registrationLockHours,
        Instant updatedAt
) {
}
