package com.sidequest.arena.repo;

import com.sidequest.arena.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /** Top-N recent entries — the audit table is append-only and grows forever, so never findAll it. */
    List<AuditLog> findTop50ByOrderByCreatedAtDesc();
}
