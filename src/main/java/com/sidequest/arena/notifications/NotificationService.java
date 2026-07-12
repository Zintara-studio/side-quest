package com.sidequest.arena.notifications;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.Notification;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.dto.NotificationView;
import com.sidequest.arena.repo.NotificationRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Per-user in-app notifications: the current user's feed (newest first), unread count, and
 * mark-read operations. Other services call {@link #create} to enqueue a notification on an event.
 * All read/mutate operations are scoped to the authenticated user — one user can never see or touch
 * another's notifications.
 */
@Service
public class NotificationService {

    /** Notifications are kept for 30 days, then swept — the table would otherwise grow without bound. */
    private static final Duration RETENTION = Duration.ofDays(30);

    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    /** Daily sweep: hard-delete notifications older than {@link #RETENTION}. */
    @Scheduled(fixedDelay = 86_400_000L) // once a day
    @Transactional
    public void purgeOld() {
        notifications.deleteByCreatedAtBefore(Instant.now().minus(RETENTION));
    }

    @Transactional(readOnly = true)
    public List<NotificationView> list() {
        return notifications.findTop100ByUserIdOrderByCreatedAtDesc(SecurityUtils.currentUserId())
                .stream()
                .map(NotificationService::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return notifications.countByUserIdAndReadFalse(SecurityUtils.currentUserId());
    }

    @Transactional
    public NotificationView markRead(String id) {
        Notification n = require(id);
        n.setRead(true);
        return toView(notifications.save(n));
    }

    @Transactional
    public void markAllRead() {
        List<Notification> unread = notifications.findByUserIdAndReadFalse(SecurityUtils.currentUserId());
        unread.forEach(n -> n.setRead(true));
        notifications.saveAll(unread);
    }

    /** Enqueue a notification for a user (used by the seeder and event-producing services). */
    @Transactional
    public Notification create(User user, NotificationType type, String title, String body, String linkUrl) {
        Notification n = new Notification();
        n.setUser(user);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLinkUrl(linkUrl);
        return notifications.save(n);
    }

    /**
     * Enqueue the same notification for many users in one transaction, de-duplicating by user id and
     * skipping nulls. Used for fan-out events (e.g. notifying every player fielded for a match).
     */
    @Transactional
    public void createMany(Collection<User> users, NotificationType type, String title, String body,
                           String linkUrl) {
        if (users == null || users.isEmpty()) {
            return;
        }
        Set<UUID> seen = new HashSet<>();
        List<Notification> batch = new ArrayList<>();
        for (User user : users) {
            if (user == null || user.getId() == null || !seen.add(user.getId())) {
                continue;
            }
            Notification n = new Notification();
            n.setUser(user);
            n.setType(type);
            n.setTitle(title);
            n.setBody(body);
            n.setLinkUrl(linkUrl);
            batch.add(n);
        }
        notifications.saveAll(batch);
    }

    // ---- helpers ----

    /** Load a notification owned by the current user, or 404 (also hides other users' notifications). */
    private Notification require(String id) {
        UUID uid;
        try {
            uid = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Notification", id);
        }
        Notification n = notifications.findById(uid)
                .orElseThrow(() -> ApiException.notFound("Notification", id));
        if (n.getUser() == null || !n.getUser().getId().equals(SecurityUtils.currentUserId())) {
            throw ApiException.notFound("Notification", id);
        }
        return n;
    }

    private static NotificationView toView(Notification n) {
        return new NotificationView(
                n.getId().toString(),
                n.getType() != null ? n.getType().name() : null,
                n.getTitle(),
                n.getBody(),
                n.getLinkUrl(),
                n.isRead(),
                n.getCreatedAt());
    }
}
