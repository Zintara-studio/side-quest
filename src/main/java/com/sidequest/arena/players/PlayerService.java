package com.sidequest.arena.players;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.model.PlayerGameUsername;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.players.dto.PlayerDetail;
import com.sidequest.arena.players.dto.PlayerMatchView;
import com.sidequest.arena.players.dto.PlayerSummary;
import com.sidequest.arena.players.dto.UpdatePlayerRequest;
import com.sidequest.arena.players.dto.UpdateStatusRequest;
import com.sidequest.arena.players.dto.UsernameView;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerGameUsernameRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Player directory, profile and standings logic: listing/filtering, profile detail, a player's
 * franchise match history, game handles (with owner/admin visibility rules), and owner/admin edits.
 */
@Service
public class PlayerService {

    private final PlayerRepository playerRepository;
    @SuppressWarnings("unused")
    private final FranchiseRepository franchiseRepository;
    private final MatchParticipantRepository matchParticipantRepository;
    private final ResultRowRepository resultRowRepository;
    private final PlayerGameUsernameRepository playerGameUsernameRepository;
    private final PlayerGameProficiencyRepository playerGameProficiencyRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public PlayerService(PlayerRepository playerRepository,
                         FranchiseRepository franchiseRepository,
                         MatchParticipantRepository matchParticipantRepository,
                         ResultRowRepository resultRowRepository,
                         PlayerGameUsernameRepository playerGameUsernameRepository,
                         PlayerGameProficiencyRepository playerGameProficiencyRepository,
                         AuditService auditService,
                         NotificationService notificationService) {
        this.playerRepository = playerRepository;
        this.franchiseRepository = franchiseRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.playerGameUsernameRepository = playerGameUsernameRepository;
        this.playerGameProficiencyRepository = playerGameProficiencyRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    /**
     * List players ordered by points desc, optionally filtered by franchise, game proficiency and
     * status, then paginated.
     */
    @Cacheable(CacheConfig.PLAYERS)
    @Transactional(readOnly = true)
    public PageResponse<PlayerSummary> list(UUID franchiseId, UUID gameId, PlayerStatus status,
                                            Integer limit, String cursor) {
        List<Player> players = playerRepository.findAllByOrderByPointsDesc();

        if (franchiseId != null) {
            players = players.stream()
                    .filter(p -> p.getFranchise() != null
                            && franchiseId.equals(p.getFranchise().getId()))
                    .toList();
        }

        if (gameId != null) {
            Set<UUID> playerIds = playerGameProficiencyRepository.findByGameId(gameId).stream()
                    .map(prof -> prof.getPlayer().getId())
                    .collect(Collectors.toSet());
            players = players.stream()
                    .filter(p -> playerIds.contains(p.getId()))
                    .toList();
        }

        if (status != null) {
            players = players.stream()
                    .filter(p -> p.getStatus() == status)
                    .toList();
        }

        List<PlayerSummary> summaries = players.stream()
                .map(PlayerService::toSummary)
                .toList();

        return Cursors.paginate(summaries, cursor, limit);
    }

    /** Full profile for a single player. */
    @Transactional(readOnly = true)
    public PlayerDetail get(UUID id) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));
        return toDetail(player);
    }

    /**
     * Past/scheduled matches for the player's franchise, newest first, including the franchise's
     * placement when results exist. Empty if the player has no franchise.
     */
    @Transactional(readOnly = true)
    public List<PlayerMatchView> matches(UUID id) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));

        Franchise franchise = player.getFranchise();
        if (franchise == null) {
            return List.of();
        }
        UUID franchiseId = franchise.getId();

        return matchParticipantRepository.findByFranchiseId(franchiseId).stream()
                .map(MatchParticipant::getMatch)
                .map(match -> toMatchView(match, franchiseId))
                .sorted(Comparator.comparing(PlayerMatchView::scheduledAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /**
     * The player's game handles. The owner (or an admin) sees all handles; everyone else sees only
     * the public ones.
     */
    @Transactional(readOnly = true)
    public List<UsernameView> usernames(UUID id) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));

        boolean privileged = isOwner(player) || SecurityUtils.isAdmin();

        List<PlayerGameUsername> usernames = privileged
                ? playerGameUsernameRepository.findByPlayerId(id)
                : playerGameUsernameRepository.findByPlayerIdAndIsPublicTrue(id);

        return usernames.stream()
                .map(u -> new UsernameView(
                        u.getGame().getId().toString(),
                        u.getGame().getName(),
                        u.getHandle(),
                        u.isPublic()))
                .toList();
    }

    /** Owner/admin partial update of a player's profile fields. Returns the updated profile. */
    @CacheEvict(value = CacheConfig.PLAYERS, allEntries = true)
    @Transactional
    public PlayerDetail update(UUID id, UpdatePlayerRequest request) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));

        if (!isOwner(player) && !SecurityUtils.isAdmin()) {
            throw ApiException.forbidden("You may only edit your own profile");
        }

        if (request.gamerTag() != null) {
            player.setGamerTag(request.gamerTag());
        }
        if (request.avatarUrl() != null) {
            player.setAvatarUrl(request.avatarUrl());
        }
        if (request.region() != null) {
            player.setRegion(request.region());
        }
        if (request.bio() != null) {
            player.setBio(request.bio());
        }

        Player saved = playerRepository.save(player);
        return toDetail(saved);
    }

    /**
     * Admin-only change of a player's account standing. Records an audit entry and notifies the
     * affected player in-app so they learn their account was verified / flagged / suspended.
     */
    @CacheEvict(value = CacheConfig.PLAYERS, allEntries = true)
    @Transactional
    public PlayerDetail updateStatus(UUID id, UpdateStatusRequest request) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));

        PlayerStatus previous = player.getStatus();
        player.setStatus(request.status());
        Player saved = playerRepository.save(player);

        auditService.record("player.status", "Player", id.toString(),
                "Set " + saved.getGamerTag() + " to " + request.status());

        // Notify the player whose standing changed (skip no-op updates).
        if (previous != request.status() && saved.getUser() != null) {
            notificationService.create(saved.getUser(), NotificationType.GENERAL,
                    "Account status updated",
                    "Your player account is now " + request.status() + ".",
                    "/player/" + saved.getId());
        }
        return toDetail(saved);
    }

    // ---- helpers ----

    private static boolean isOwner(Player player) {
        return SecurityUtils.currentPrincipal().isPresent()
                && player.getUser().getId().equals(SecurityUtils.currentUserId());
    }

    private PlayerMatchView toMatchView(Match match, UUID franchiseId) {
        Integer rank = null;
        Integer total = null;
        for (ResultRow row : resultRowRepository.findByMatchIdOrderByRankAsc(match.getId())) {
            if (franchiseId.equals(row.getFranchise().getId())) {
                rank = row.getRank();
                total = row.getTotal();
                break;
            }
        }
        return new PlayerMatchView(
                match.getId().toString(),
                match.getGame().getName(),
                match.getScheduledAt(),
                match.getStatus().name(),
                rank,
                total);
    }

    private static PlayerSummary toSummary(Player player) {
        Franchise franchise = player.getFranchise();
        return new PlayerSummary(
                player.getId().toString(),
                player.getGamerTag(),
                player.getAvatarUrl(),
                player.getRegion(),
                player.getStatus().name(),
                player.getPoints(),
                franchise != null ? franchise.getId().toString() : null,
                franchise != null ? franchise.getName() : null);
    }

    private PlayerDetail toDetail(Player player) {
        Franchise franchise = player.getFranchise();
        PlayerDetail.FranchiseMini franchiseMini = franchise == null ? null
                : new PlayerDetail.FranchiseMini(
                        franchise.getId().toString(),
                        franchise.getName(),
                        franchise.getTag());

        List<PlayerDetail.ProficiencyView> proficiencies =
                playerGameProficiencyRepository.findByPlayerId(player.getId()).stream()
                        .map(PlayerService::toProficiencyView)
                        .toList();

        return new PlayerDetail(
                player.getId().toString(),
                player.getGamerTag(),
                player.getAvatarUrl(),
                player.getRegion(),
                player.getBio(),
                player.getStatus().name(),
                player.getPoints(),
                new PlayerDetail.UserMini(player.getUser().getName()),
                franchiseMini,
                proficiencies);
    }

    private static PlayerDetail.ProficiencyView toProficiencyView(PlayerGameProficiency prof) {
        return new PlayerDetail.ProficiencyView(
                prof.getGame().getId().toString(),
                prof.getGame().getName(),
                prof.getRating());
    }
}
