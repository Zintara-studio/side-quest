package com.sidequest.arena.announcements.dto;

import com.sidequest.arena.model.AnnouncementCategory;

/**
 * Request body for {@code PATCH /announcements/{id}} (admin). All fields are optional; only the
 * non-null fields are applied.
 *
 * @param category new category, nullable
 * @param title    new title, nullable
 * @param body     new body, nullable
 */
public record UpdateAnnouncementRequest(
        AnnouncementCategory category,
        String title,
        String body
) {
}
