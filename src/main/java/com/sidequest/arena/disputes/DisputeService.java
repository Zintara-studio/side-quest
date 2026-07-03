package com.sidequest.arena.disputes;

import com.sidequest.arena.admin.dto.DisputeView;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeCategory;
import com.sidequest.arena.model.DisputeStatus;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.MatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * User-facing dispute operations: open a new dispute (a match-result challenge, an account-status
 * appeal, or a general issue) and list the disputes the current user has raised. Admin triage
 * (resolve / dismiss) stays in {@link com.sidequest.arena.admin.AdminService}.
 */
@Service
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final MatchRepository matchRepository;
    private final AuditService auditService;

    public DisputeService(DisputeRepository disputeRepository,
                          MatchRepository matchRepository,
                          AuditService auditService) {
        this.disputeRepository = disputeRepository;
        this.matchRepository = matchRepository;
        this.auditService = auditService;
    }

    /**
     * Open a new OPEN dispute raised by {@code current}. When {@code matchId} is non-null it is
     * resolved to a match (RESULT disputes); appeals / general disputes pass {@code null}. A null
     * {@code category} defaults to {@link DisputeCategory#RESULT}.
     */
    @Transactional
    public DisputeView raiseDispute(User current, UUID matchId, String reason, DisputeCategory category) {
        if (reason == null || reason.isBlank()) {
            throw ApiException.badRequest("reason is required to raise a dispute");
        }

        Dispute dispute = new Dispute();
        dispute.setRaisedBy(current);
        dispute.setReason(reason.trim());
        dispute.setCategory(category != null ? category : DisputeCategory.RESULT);
        dispute.setStatus(DisputeStatus.OPEN);
        if (matchId != null) {
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> ApiException.notFound("Match", matchId));
            dispute.setMatch(match);
        }

        Dispute saved = disputeRepository.save(dispute);
        auditService.record("dispute.raise", "Dispute", saved.getId().toString(),
                saved.getCategory().name() + " dispute opened");
        return toView(saved);
    }

    /** The disputes the current user has raised, newest first. */
    @Transactional(readOnly = true)
    public List<DisputeView> myDisputes(User current) {
        return disputeRepository.findByRaisedByIdOrderByCreatedAtDesc(current.getId()).stream()
                .map(DisputeService::toView)
                .toList();
    }

    // ---- helpers ----

    private static DisputeView toView(Dispute dispute) {
        Match match = dispute.getMatch();
        String matchId = match != null ? match.getId().toString() : null;
        String matchTitle = match != null && match.getGame() != null ? match.getGame().getName() : null;
        return new DisputeView(
                dispute.getId().toString(),
                matchId,
                matchTitle,
                dispute.getReason(),
                dispute.getCategory() != null ? dispute.getCategory().name() : null,
                dispute.getStatus().name(),
                dispute.getResolution(),
                dispute.getCreatedAt());
    }
}
