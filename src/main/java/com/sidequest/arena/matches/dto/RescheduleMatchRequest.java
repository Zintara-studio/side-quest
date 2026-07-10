package com.sidequest.arena.matches.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Body for {@code POST /matches/{id}/reschedule} — move a fixture to a new (future) time.
 *
 * @param scheduledAt the new scheduled start (required, must be in the future — enforced server-side)
 */
public record RescheduleMatchRequest(
        @NotNull Instant scheduledAt
) {
}
