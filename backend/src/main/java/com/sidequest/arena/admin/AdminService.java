package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.DisputeView;
import com.sidequest.arena.admin.dto.OverviewResponse;
import com.sidequest.arena.admin.dto.ResolveDisputeRequest;
import com.sidequest.arena.admin.dto.TeamMember;
import com.sidequest.arena.admin.dto.UpdateAvatarRequest;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.games.GameCatalogSeeder;
import com.sidequest.arena.media.MediaRefs;
import com.sidequest.arena.model.AdminLevel;
import com.sidequest.arena.model.AuditLog;
import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeCategory;
import com.sidequest.arena.model.DisputeStatus;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RefreshTokenRepository;
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
    // The overview panel is scrollable, so surface a fuller trail (the repo already bounds the fetch at 50).
    private static final int RECENT_ACTIVITY_LIMIT = 40;

    private final PlayerRepository playerRepository;
    private final FranchiseRepository franchiseRepository;
    private final GameRepository gameRepository;
    private final MatchRepository matchRepository;
    private final UserRepository userRepository;
    private final RegistrationRepository registrationRepository;
    private final DisputeRepository disputeRepository;
    private final NotificationService notificationService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final GameCatalogSeeder gameCatalogSeeder;
    private final AuditService auditService;

    public AdminService(PlayerRepository playerRepository,
                        FranchiseRepository franchiseRepository,
                        GameRepository gameRepository,
                        MatchRepository matchRepository,
                        UserRepository userRepository,
                        RegistrationRepository registrationRepository,
                        DisputeRepository disputeRepository,
                        NotificationService notificationService,
                        RefreshTokenRepository refreshTokenRepository,
                        GameCatalogSeeder gameCatalogSeeder,
                        AuditService auditService) {
        this.playerRepository = playerRepository;
        this.franchiseRepository = franchiseRepository;
        this.gameRepository = gameRepository;
        this.matchRepository = matchRepository;
        this.userRepository = userRepository;
        this.registrationRepository = registrationRepository;
        this.disputeRepository = disputeRepository;
        this.notificationService = notificationService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.gameCatalogSeeder = gameCatalogSeeder;
        this.auditService = auditService;
    }

    /**
     * Main admin: seed the static config (games catalogue) into the database on demand — the same
     * idempotent seed that runs at first boot, so a live instance can be filled without a restart.
     */
    @Transactional
    public com.sidequest.arena.admin.dto.SeedResult seedStaticConfig() {
        int created = gameCatalogSeeder.seedGames();
        auditService.record("config.seed", "Game", "-", created + " game(s) seeded");
        return new com.sidequest.arena.admin.dto.SeedResult(created, gameRepository.count());
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

    /**
     * Set the calling admin's own account-level avatar. Self-scoped (operates on the current user only);
     * the value is validated to a server-issued {@code /media/{id}} reference (or blank to clear) exactly
     * like a player's avatar, so an arbitrary external URL can't be injected.
     */
    @Transactional
    public void updateOwnAvatar(UpdateAvatarRequest request) {
        UUID userId = SecurityUtils.currentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User", userId));
        String avatar = MediaRefs.normalize(request.avatarUrl(), "avatarUrl");
        user.setAvatarUrl(avatar.isEmpty() ? null : avatar);
        userRepository.save(user);
        auditService.record("admin.avatar", "User", userId.toString(),
                avatar.isEmpty() ? "cleared their avatar" : "updated their avatar");
    }

    /** Open disputes, newest first. */
    @Transactional(readOnly = true)
    public List<DisputeView> openDisputes() {
        return disputeRepository.findByStatusOrderByCreatedAtDesc(DisputeStatus.OPEN).stream()
                .map(this::toDisputeView)
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

        // Close the loop with the person who raised it — otherwise a dispute resolution is invisible.
        User raiser = saved.getRaisedBy();
        if (raiser != null) {
            boolean isResult = saved.getCategory() == DisputeCategory.RESULT && saved.getMatch() != null;
            String link = isResult ? "/match/" + saved.getMatch().getId() : "/notifications";
            String body = (dismiss ? "Your dispute was reviewed and dismissed." : "Your dispute was resolved.")
                    + (request.resolution() != null && !request.resolution().isBlank()
                            ? " " + request.resolution().trim() : "");
            notificationService.create(raiser,
                    isResult ? NotificationType.RESULT : NotificationType.GENERAL,
                    dismiss ? "Dispute dismissed" : "Dispute resolved", body, link);
        }

        auditService.record("dispute.resolve", "Dispute", saved.getId().toString(),
                (dismiss ? "dismissed" : "resolved") + ": " + request.resolution());

        return toDisputeView(saved);
    }

    /** Staff roster: every admin (any tier) plus franchise managers. */
    @Transactional(readOnly = true)
    public List<TeamMember> team() {
        List<TeamMember> members = new ArrayList<>();
        // Admins are identified by adminLevel (orthogonal to role), so a player promoted to admin shows
        // here while keeping their PLAYER/FRANCHISE role.
        userRepository.findByAdminLevelNotOrderByNameAsc(AdminLevel.NONE).stream()
                .map(this::toTeamMember)
                .forEach(members::add);
        userRepository.findByRole(Role.FRANCHISE_MANAGER).stream()
                // A franchise manager who is also an admin is already listed above — don't duplicate.
                .filter(u -> u.getAdminLevel() == AdminLevel.NONE)
                .map(this::toTeamMember)
                .forEach(members::add);
        return members;
    }

    /**
     * Main admin only: appoint a player as an admin (adminLevel ADMIN). Appointed admins ARE players, so
     * the target is a player; their account is promoted while keeping its player identity. Not applicable
     * to an account already an admin. Audited + the person is notified.
     */
    @Transactional
    public TeamMember appointAdmin(String playerId) {
        Player player = playerRepository.findById(parseId(playerId))
                .orElseThrow(() -> ApiException.notFound("Player", playerId));
        User user = player.getUser();
        if (user.getAdminLevel() != AdminLevel.NONE) {
            throw ApiException.conflict("That player is already an admin");
        }
        user.setAdminLevel(AdminLevel.ADMIN);
        userRepository.save(user);
        notificationService.create(user, NotificationType.GENERAL,
                "You're now an admin",
                "The main admin has appointed you as a league admin. A Control room is now available "
                        + "from your account menu.", "/admin");
        auditService.record("admin.appoint", "User", user.getId().toString(), user.getEmail());
        return toTeamMember(user);
    }

    /**
     * Main admin only: revoke an appointed admin (back to adminLevel NONE). The main admin (SUPER_ADMIN)
     * cannot be revoked — there is exactly one. Revoking immediately invalidates the person's existing
     * sessions (their refresh tokens are killed). Audited + the person is notified.
     */
    @Transactional
    public void revokeAdmin(String playerId) {
        Player player = playerRepository.findById(parseId(playerId))
                .orElseThrow(() -> ApiException.notFound("Player", playerId));
        User user = player.getUser();
        if (user.getAdminLevel() == AdminLevel.SUPER_ADMIN) {
            throw ApiException.conflict("The main admin cannot be revoked");
        }
        if (user.getAdminLevel() == AdminLevel.NONE) {
            throw ApiException.conflict("That player is not an admin");
        }
        user.setAdminLevel(AdminLevel.NONE);
        userRepository.save(user);
        // Cut their admin access immediately rather than waiting for the ~1h access-token to expire.
        refreshTokenRepository.revokeAllForUser(user.getId());
        notificationService.create(user, NotificationType.GENERAL,
                "Admin access removed",
                "Your league admin access has been removed.", "/");
        auditService.record("admin.revoke", "User", user.getId().toString(), user.getEmail());
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

    private DisputeView toDisputeView(Dispute dispute) {
        Match match = dispute.getMatch();
        String matchTitle = match != null && match.getGame() != null ? match.getGame().getName() : null;
        User raiser = dispute.getRaisedBy();
        String raisedByName = raiser != null ? raiser.getName() : null;
        String raisedByGamerTag = raiser == null ? null
                : playerRepository.findByUserId(raiser.getId())
                        .map(com.sidequest.arena.model.Player::getGamerTag).orElse(null);
        return new DisputeView(
                dispute.getId().toString(),
                match != null ? match.getId().toString() : null,
                matchTitle,
                dispute.getReason(),
                dispute.getCategory() != null ? dispute.getCategory().name() : null,
                dispute.getStatus().name(),
                dispute.getResolution(),
                dispute.getCreatedAt(),
                raisedByName,
                raisedByGamerTag);
    }

    private TeamMember toTeamMember(User user) {
        String playerId = playerRepository.findByUserId(user.getId())
                .map(p -> p.getId().toString())
                .orElse(null);
        return new TeamMember(
                user.getId().toString(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getAdminLevel().name(),
                playerId);
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
