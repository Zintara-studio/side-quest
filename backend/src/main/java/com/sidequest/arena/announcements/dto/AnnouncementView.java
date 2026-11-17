package com.sidequest.arena.announcements.dto;

import java.time.Instant;

/**
 * A league-feed post as returned to clients.
 *
 * @param id          announcement id
 * @param category    category name (GENERAL / RESULT / RECAP / MATCH / ROSTER)
 * @param title       post title
 * @param body        post body
 * @param matchId     id of the linked match, or {@code null} if not tied to a match
 * @param matchSlug   the linked match's pretty slug, or {@code null} if not tied to a match
 * @param author      author's display name, or {@code null} if unknown
 * @param publishedAt publication timestamp
 */
public record AnnouncementView(
        String id,
        String shortCode,
        String category,
        String title,
        String body,
        String matchId,
        String matchSlug,
        String author,
        Instant publishedAt,
        boolean registrationOpen,
        boolean pinned,
        String gameId,
        String gameName,
        String registrationType,
        Integer teamSize
) {
}
