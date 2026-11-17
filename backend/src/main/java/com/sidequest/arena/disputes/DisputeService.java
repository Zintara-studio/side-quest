package com.sidequest.arena.disputes;

import com.sidequest.arena.admin.dto.DisputeView;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeCategory;
import com.sidequest.arena.model.DisputeStatus;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.UserRepository;
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
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public DisputeService(DisputeRepository disputeRepository,
                          MatchRepository matchRepository,
                          PlayerRepository playerRepository,
                          UserRepository userRepository,
                          NotificationService notificationService,
                          AuditService auditService) {
        this.disputeRepository = disputeRepository;
        this.matchRepository = matchRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
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

        // Alert admins so a raised dispute actually reaches the triage queue.
        String raiserTag = playerRepository.findByUserId(current.getId())
                .map(Player::getGamerTag).orElse(current.getName());
        String what = saved.getCategory() == DisputeCategory.RESULT && saved.getMatch() != null
                ? "a result dispute for "
                        + (saved.getMatch().getGame() != null ? saved.getMatch().getGame().getName() : "a match")
                : "a " + saved.getCategory().name().toLowerCase() + " dispute";
        for (User admin : userRepository.findByRole(Role.ADMIN)) {
            notificationService.create(admin, NotificationType.GENERAL, "New dispute",
                    (raiserTag != null ? raiserTag : "A player") + " raised " + what + ".", "/admin/disputes");
        }

        auditService.record("dispute.raise", "Dispute", saved.getId().toString(),
                saved.getCategory().name() + " dispute opened");
        return toView(saved);
    }

    /** The disputes the current user has raised, newest first. */
    @Transactional(readOnly = true)
    public List<DisputeView> myDisputes(User current) {
        return disputeRepository.findByRaisedByIdOrderByCreatedAtDesc(current.getId()).stream()
                .map(this::toView)
                .toList();
    }

    // ---- helpers ----

    private DisputeView toView(Dispute dispute) {
        Match match = dispute.getMatch();
        String matchId = match != null ? match.getId().toString() : null;
        String matchTitle = match != null && match.getGame() != null ? match.getGame().getName() : null;
        User raiser = dispute.getRaisedBy();
        String raisedByName = raiser != null ? raiser.getName() : null;
        String raisedByGamerTag = raiser == null ? null
                : playerRepository.findByUserId(raiser.getId()).map(Player::getGamerTag).orElse(null);
        return new DisputeView(
                dispute.getId().toString(),
                matchId,
                matchTitle,
                dispute.getReason(),
                dispute.getCategory() != null ? dispute.getCategory().name() : null,
                dispute.getStatus().name(),
                dispute.getResolution(),
                dispute.getCreatedAt(),
                raisedByName,
                raisedByGamerTag);
    }
}
