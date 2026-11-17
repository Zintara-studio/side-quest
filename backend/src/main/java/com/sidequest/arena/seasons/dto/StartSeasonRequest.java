package com.sidequest.arena.seasons.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Admin payload for {@code POST /seasons/start}. Finishes the current active season (snapshotting its
 * standings) and begins a new active season. The {@code code} must be unique.
 *
 * @param code stable season code, e.g. "S05" (required, unique)
 * @param name display name, e.g. "Season 05 — Summer" (required)
 */
public record StartSeasonRequest(
        @NotBlank String code,
        @NotBlank String name
) {
}
