package com.sidequest.arena.auctions.dto;

import java.time.Instant;

/**
 * Admin payload for {@code POST /auctions/{id}/reschedule}: the new planned go-live time (nullable to
 * clear it).
 *
 * @param scheduledAt the new scheduled time, or {@code null} to unset
 */
public record RescheduleRequest(
        Instant scheduledAt
) {
}
