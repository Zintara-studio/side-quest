package com.sidequest.arena.notifications.dto;

import java.time.Instant;

/** A single in-app notification as exposed to its owning user. */
public record NotificationView(
        String id,
        String type,
        String title,
        String body,
        String linkUrl,
        boolean read,
        Instant createdAt
) {
}
