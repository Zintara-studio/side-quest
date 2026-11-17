package com.sidequest.arena.audit;

import com.sidequest.arena.model.AuditLog;
import com.sidequest.arena.repo.AuditLogRepository;
import com.sidequest.arena.security.SecurityUtils;
import com.sidequest.arena.security.UserPrincipal;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Records admin actions to the append-only audit trail (who / what / when). Called by services
 * after every mutating admin operation.
 */
@Service
public class AuditService {

    /**
     * How long an audit entry is kept before the daily sweep removes it. Deliberately short — the trail
     * is only used for the admin "recent activity" panel, so a small window keeps the append-only table
     * from growing without bound at minimal storage cost. NOTE (security): this is a short forensic
     * window; if longer-term admin-action history is ever needed (investigations, compliance), raise
     * this — the storage cost of a week or a month of these tiny rows is still negligible.
     */
    private static final Duration RETENTION = Duration.ofDays(7);

    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void record(String action, String entityType, String entityId, String detail) {
        AuditLog log = new AuditLog();
        SecurityUtils.currentPrincipal().ifPresent((UserPrincipal p) -> {
            log.setActorId(p.getUserId());
            log.setActorEmail(p.getUsername());
        });
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setDetail(detail);
        repo.save(log);
    }

    /** The most recent entries (bounded at the DB — the audit table is append-only, never findAll it). */
    @Transactional(readOnly = true)
    public List<AuditLog> recent() {
        return repo.findTop50ByOrderByCreatedAtDesc();
    }

    /** Daily sweep: hard-delete audit entries older than {@link #RETENTION}. */
    @Scheduled(fixedDelay = 86_400_000L) // once a day
    @Transactional
    public void purgeOld() {
        repo.deleteByCreatedAtBefore(Instant.now().minus(RETENTION));
    }
}
