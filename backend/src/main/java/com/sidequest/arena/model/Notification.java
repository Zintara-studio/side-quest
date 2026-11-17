package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An in-app notification addressed to a single {@link User} (Notification N—1 User). Created by the
 * platform on events (registration reviewed, match result published, announcement, …) and surfaced
 * on the user's notifications page.
 */
@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notifications_user", columnList = "user_id"),
        // Covers the unread-count/badge reads. Added under a NEW name (Hibernate update would silently
        // skip a same-named index with changed columns on an existing database).
        @Index(name = "idx_notifications_user_read", columnList = "user_id, is_read")
})
@Getter
@Setter
@NoArgsConstructor
public class Notification extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationType type = NotificationType.GENERAL;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String body;

    /** Optional in-app link the notification points to (e.g. "/match" or "/notifications"). */
    @Column(name = "link_url")
    private String linkUrl;

    @Column(name = "is_read", nullable = false)
    private boolean read = false;
}
