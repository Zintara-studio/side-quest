package com.sidequest.arena.admin.dto;

/**
 * Partial update for the singleton league settings ({@code PATCH /settings}). Only non-null fields
 * are applied.
 *
 * @param seasonId         new season identifier, or {@code null} to leave unchanged
 * @param seasonName       new season name, or {@code null} to leave unchanged
 * @param pointsPerKill    new points-per-kill, or {@code null} to leave unchanged
 * @param placementPoints  new placement points csv, or {@code null} to leave unchanged
 * @param registrationOpen new registration switch, or {@code null} to leave unchanged
 */
public record UpdateSettingsRequest(
        String seasonId,
        String seasonName,
        Integer pointsPerKill,
        String placementPoints,
        Boolean registrationOpen
) {
}
