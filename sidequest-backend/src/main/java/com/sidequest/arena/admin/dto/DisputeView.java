package com.sidequest.arena.admin.dto;

import java.time.Instant;

/**
 * Read model for a result dispute.
 *
 * @param id         dispute id
 * @param matchId    the disputed match id
 * @param reason     why the dispute was raised
 * @param status     current dispute status
 * @param resolution the resolution note, if any
 * @param createdAt  when the dispute was raised
 */
public record DisputeView(
        String id,
        String matchId,
        String reason,
        String status,
        String resolution,
        Instant createdAt
) {
}
