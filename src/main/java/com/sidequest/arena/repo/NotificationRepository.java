package com.sidequest.arena.repo;

import com.sidequest.arena.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** Bounded feed for the notifications page — the table grows unbounded, so never load the whole history. */
    List<Notification> findTop100ByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Notification> findByUserIdAndReadFalse(UUID userId);

    long countByUserIdAndReadFalse(UUID userId);

    /** Bulk-delete notifications older than the cutoff (30-day retention sweep). Returns rows removed. */
    @Modifying
    @Query("delete from Notification n where n.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") Instant cutoff);
}
