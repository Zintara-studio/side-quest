package com.sidequest.arena.notifications;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.Notification;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.dto.NotificationView;
import com.sidequest.arena.repo.NotificationRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Per-user in-app notifications: the current user's feed (newest first), unread count, and
 * mark-read operations. Other services call {@link #create} to enqueue a notification on an event.
 * All read/mutate operations are scoped to the authenticated user — one user can never see or touch
 * another's notifications.
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
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
