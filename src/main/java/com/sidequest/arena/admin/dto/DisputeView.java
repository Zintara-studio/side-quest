package com.sidequest.arena.admin.dto;

import java.time.Instant;

/**
 * Read model for a dispute (result challenge, account appeal, or general issue). Used by the admin
 * triage endpoints and by the user-facing {@code GET /disputes/mine}.
 *
 * @param id         dispute id
 * @param matchId    the disputed match id, or {@code null} for appeals / general disputes
 * @param matchTitle a human label for the disputed match (game name), or {@code null} when no match
 * @param reason     why the dispute was raised
 * @param category   {@link com.sidequest.arena.model.DisputeCategory} name (RESULT / APPEAL / GENERAL)
 * @param status     current dispute status
 * @param resolution the resolution note, if any
 * @param createdAt  when the dispute was raised
 */
public record DisputeView(
        String id,
        String matchId,
        String matchTitle,
        String reason,
        String category,
        String status,
        String resolution,
        Instant createdAt
) {
}
