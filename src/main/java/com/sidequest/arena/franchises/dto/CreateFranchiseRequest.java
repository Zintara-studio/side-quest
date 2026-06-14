package com.sidequest.arena.franchises.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin payload for {@code POST /franchises}. Creates a franchise with zeroed standings and
 * {@code active = true}. {@code seasonId} and {@code logoUrl} are optional.
 *
 * @param name     franchise name (required)
 * @param tag      short team tag (required, max 16 chars)
 * @param seasonId season to assign the franchise to (optional)
 * @param logoUrl  logo image url (optional)
 */
public record CreateFranchiseRequest(
        @NotBlank String name,
        @NotBlank @Size(max = 16) String tag,
        String seasonId,
        String logoUrl
) {
}
