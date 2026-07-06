package com.sidequest.arena.repo;

import com.sidequest.arena.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** Bounded feed for the notifications page — the table grows unbounded, so never load the whole history. */
    List<Notification> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Notification> findByUserIdAndReadFalse(UUID userId);

    long countByUserIdAndReadFalse(UUID userId);
}
