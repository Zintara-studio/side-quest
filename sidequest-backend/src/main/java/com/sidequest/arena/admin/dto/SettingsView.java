package com.sidequest.arena.admin.dto;

import java.time.Instant;

/**
 * Read model for the singleton league settings.
 *
 * @param seasonId         current season identifier
 * @param seasonName       human-readable season name
 * @param pointsPerKill    points awarded per kill by the scoring engine
 * @param placementPoints  placement points csv (highest finish first)
 * @param registrationOpen master registration switch
 * @param updatedAt        when the settings were last changed
 */
public record SettingsView(
        String seasonId,
        String seasonName,
        int pointsPerKill,
        String placementPoints,
        boolean registrationOpen,
        Instant updatedAt
) {
}
