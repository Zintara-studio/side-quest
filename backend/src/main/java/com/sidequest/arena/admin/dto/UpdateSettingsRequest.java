package com.sidequest.arena.admin.dto;

/**
 * Partial update for the singleton league settings ({@code PATCH /settings}). Only non-null fields are
 * applied. (Scoring is configured per-game; registration windows are opened per announcement.)
 *
 * @param seasonId               new season identifier, or {@code null} to leave unchanged
 * @param seasonName             new season name, or {@code null} to leave unchanged
 * @param registrationLockHours  new registration-lock window in hours, or {@code null} to leave unchanged
 */
public record UpdateSettingsRequest(
        String seasonId,
        String seasonName,
        Integer registrationLockHours
) {
}
