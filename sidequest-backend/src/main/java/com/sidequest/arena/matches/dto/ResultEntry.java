package com.sidequest.arena.matches.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * One franchise's raw scores when entering match results. Total and rank are computed server-side.
 *
 * @param franchiseId the franchise this line is for (required)
 * @param kills       kill points scored
 * @param placePts    placement points scored
 */
public record ResultEntry(
        @NotBlank String franchiseId,
        int kills,
        int placePts
) {
}
