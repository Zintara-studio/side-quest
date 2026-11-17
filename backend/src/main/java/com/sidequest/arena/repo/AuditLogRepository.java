package com.sidequest.arena.repo;

import com.sidequest.arena.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /** Top-N recent entries — the audit table is append-only, so read only the most recent slice. */
    List<AuditLog> findTop50ByOrderByCreatedAtDesc();

    /** Bulk-delete entries older than the cutoff — the daily retention sweep. Returns rows removed. */
    @Modifying
    @Query("delete from AuditLog a where a.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") Instant cutoff);
}
