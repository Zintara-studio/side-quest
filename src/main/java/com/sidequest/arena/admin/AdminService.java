package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.DisputeView;
import com.sidequest.arena.admin.dto.OverviewResponse;
import com.sidequest.arena.admin.dto.ResolveDisputeRequest;
import com.sidequest.arena.admin.dto.TeamMember;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.AuditLog;
import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeStatus;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Admin control-room logic: at-a-glance KPIs and totals, dispute triage, and the staff roster.
 */
@Service
public class AdminService {

    /** Number of recent audit rows surfaced on the overview. */
    private static final int RECENT_ACTIVITY_LIMIT = 10;

    private final PlayerRepository playerRepository;
    private final FranchiseRepository franchiseRepository;
    private final GameRepository gameRepository;
    private final MatchRepository matchRepository;
    private final UserRepository userRepository;
    private final RegistrationRepository registrationRepository;
    private final DisputeRepository disputeRepository;
    private final AuditService auditService;

    public AdminService(PlayerRepository playerRepository,
                        FranchiseRepository franchiseRepository,
                        GameRepository gameRepository,
                        MatchRepository matchRepository,
                        UserRepository userRepository,
                        RegistrationRepository registrationRepository,
                        DisputeRepository disputeRepository,
                        AuditService auditService) {
        this.playerRepository = playerRepository;
        this.franchiseRepository = franchiseRepository;
        this.gameRepository = gameRepository;
        this.matchRepository = matchRepository;
        this.userRepository = userRepository;
        this.registrationRepository = registrationRepository;
        this.disputeRepository = disputeRepository;
        this.auditService = auditService;
    }

    /** Control-room KPIs, aggregate totals and recent audit activity. */
    @Transactional(readOnly = true)
    public OverviewResponse overview() {
        long pendingRegistrations =
                registrationRepository.countByStatus(RegistrationStatus.PENDING);
        long resultsToEnter = matchRepository.countByStatus(MatchStatus.AWAITING_RESULT)
                + matchRepository.countByStatus(MatchStatus.LIVE);
        long openDisputes = disputeRepository.countByStatus(DisputeStatus.OPEN);

        OverviewResponse.Totals totals = new OverviewResponse.Totals(
                playerRepository.count(),
                franchiseRepository.count(),
                gameRepository.count(),
                matchRepository.count(),
                userRepository.count());

        List<OverviewResponse.ActivityRow> recentActivity = auditService.recent().stream()
                .limit(RECENT_ACTIVITY_LIMIT)
                .map(AdminService::toActivityRow)
                .toList();

        return new OverviewResponse(pendingRegistrations, resultsToEnter, openDisputes,
                totals, recentActivity);
    }

    /** Open disputes, newest first. */
    @Transactional(readOnly = true)
    public List<DisputeView> openDisputes() {
        return disputeRepository.findByStatusOrderByCreatedAtDesc(DisputeStatus.OPEN).stream()
                .map(AdminService::toDisputeView)
                .toList();
    }

    /** Resolve (or dismiss) a dispute, attributing it to the current admin; records an audit entry. */
    @Transactional
    public DisputeView resolveDispute(String id, ResolveDisputeRequest request) {
        UUID disputeId = parseId(id);
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> ApiException.notFound("Dispute", id));

        boolean dismiss = Boolean.TRUE.equals(request.dismiss());
        dispute.setStatus(dismiss ? DisputeStatus.DISMISSED : DisputeStatus.RESOLVED);
        dispute.setResolution(request.resolution());

        User currentUser = userRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.notFound("User", SecurityUtils.currentUserId()));
        dispute.setResolvedBy(currentUser);
        dispute.setResolvedAt(Instant.now());

        Dispute saved = disputeRepository.save(dispute);

        auditService.record("dispute.resolve", "Dispute", saved.getId().toString(),
                (dismiss ? "dismissed" : "resolved") + ": " + request.resolution());

        return toDisputeView(saved);
    }

    /** Staff roster: admins and franchise managers. */
    @Transactional(readOnly = true)
    public List<TeamMember> team() {
        List<TeamMember> members = new ArrayList<>();
        userRepository.findByRole(Role.ADMIN).stream()
                .map(AdminService::toTeamMember)
                .forEach(members::add);
        userRepository.findByRole(Role.FRANCHISE_MANAGER).stream()
                .map(AdminService::toTeamMember)
                .forEach(members::add);
        return members;
    }

    // ---- helpers ----

    private static OverviewResponse.ActivityRow toActivityRow(AuditLog log) {
        return new OverviewResponse.ActivityRow(
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getDetail(),
                log.getActorEmail(),
                log.getCreatedAt());
    }

    private static DisputeView toDisputeView(Dispute dispute) {
        Match match = dispute.getMatch();
        String matchTitle = match != null && match.getGame() != null ? match.getGame().getName() : null;
        return new DisputeView(
                dispute.getId().toString(),
                match != null ? match.getId().toString() : null,
                matchTitle,
                dispute.getReason(),
                dispute.getCategory() != null ? dispute.getCategory().name() : null,
                dispute.getStatus().name(),
                dispute.getResolution(),
                dispute.getCreatedAt());
    }

    private static TeamMember toTeamMember(User user) {
        return new TeamMember(
                user.getId().toString(),
                user.getName(),
                user.getEmail(),
                user.getRole().name());
    }

    /** Parse a String id to UUID; treat unparseable ids as not found. */
    private static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Dispute", id);
        }
    }
}
