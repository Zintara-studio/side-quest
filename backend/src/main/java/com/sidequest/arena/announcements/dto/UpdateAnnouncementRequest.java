package com.sidequest.arena.announcements.dto;

import com.sidequest.arena.model.AnnouncementCategory;

/**
 * Request body for {@code PATCH /announcements/{id}} (admin). All fields are optional; only the
 * non-null fields are applied.
 *
 * @param category new category, nullable
 * @param title    new title, nullable
 * @param body     new body, nullable
 * @param pinned   pin/unpin on the home page, nullable ({@code Boolean} wrapper — a primitive would
 *                 default {@code false} and silently unpin on every edit)
 */
public record UpdateAnnouncementRequest(
        AnnouncementCategory category,
        String title,
        String body,
        Boolean pinned
) {
}
