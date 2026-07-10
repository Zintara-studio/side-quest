package com.sidequest.arena.matches.dto;

import java.time.Instant;

/**
 * A single match-room message.
 *
 * @param id         message id
 * @param authorName display name of the admin who posted it
 * @param body       message text
 * @param createdAt  when it was posted
 */
public record MatchMessageView(
        String id,
        String authorName,
        String body,
        Instant createdAt
) {
}
