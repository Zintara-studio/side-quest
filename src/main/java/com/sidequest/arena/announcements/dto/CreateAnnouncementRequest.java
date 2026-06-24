package com.sidequest.arena.announcements.dto;

import com.sidequest.arena.model.AnnouncementCategory;
import com.sidequest.arena.model.RegistrationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Request body for {@code POST /announcements} (admin). {@code matchId} is accepted but not linked
 * (no cross-domain match lookup); {@code publishedAt} defaults to now when omitted.
 *
 * @param category    post category, required
 * @param title       post title, required
 * @param body        post body, required
 * @param matchId     optional match id (currently not linked), nullable
 * @param publishedAt optional publication time; defaults to {@code Instant.now()} when null
 */
public record CreateAnnouncementRequest(
        @NotNull AnnouncementCategory category,
        @NotBlank String title,
        @NotBlank String body,
        String matchId,
        Instant publishedAt,
        boolean registrationOpen,
        String gameId,
        RegistrationType registrationType
) {
}
