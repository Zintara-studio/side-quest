package com.sidequest.arena.notifications;

import com.sidequest.arena.notifications.dto.NotificationView;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The signed-in user's notification feed. Mounted under {@code /notifications} (global {@code /v1}
 * context path applies). Every endpoint requires authentication and is implicitly scoped to the
 * caller — not in the public-GET allowlist, so {@code .anyRequest().authenticated()} guards it.
 */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /** The current user's notifications, newest first. */
    @GetMapping
    public List<NotificationView> list() {
        return notificationService.list();
    }

    /** The current user's unread notification count (for the nav badge). */
    @GetMapping("/unread-count")
    public UnreadCountResponse unreadCount() {
        return new UnreadCountResponse(notificationService.unreadCount());
    }

    /** Mark a single notification (owned by the caller) as read. */
    @PostMapping("/{id}/read")
    public NotificationView markRead(@PathVariable String id) {
        return notificationService.markRead(id);
    }

    /** Mark all of the caller's notifications as read. */
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead() {
        notificationService.markAllRead();
        return ResponseEntity.noContent().build();
    }

    public record UnreadCountResponse(long count) {
    }
}
