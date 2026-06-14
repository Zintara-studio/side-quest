package com.sidequest.arena.audit;

import com.sidequest.arena.model.AuditLog;
import com.sidequest.arena.repo.AuditLogRepository;
import com.sidequest.arena.security.SecurityUtils;
import com.sidequest.arena.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Records admin actions to the append-only audit trail (who / what / when). Called by services
 * after every mutating admin operation.
 */
@Service
public class AuditService {

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

    @Transactional(readOnly = true)
    public List<AuditLog> recent() {
        return repo.findAllByOrderByCreatedAtDesc();
    }
}
