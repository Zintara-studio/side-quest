package com.sidequest.arena.franchises;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.franchises.dto.AssignPlayerRequest;
import com.sidequest.arena.franchises.dto.AssignRoleRequest;
import com.sidequest.arena.franchises.dto.CreateFranchiseRequest;
import com.sidequest.arena.franchises.dto.FranchiseDetail;
import com.sidequest.arena.franchises.dto.FranchiseMatchView;
import com.sidequest.arena.franchises.dto.FranchiseSummary;
import com.sidequest.arena.franchises.dto.RosterMember;
import com.sidequest.arena.franchises.dto.UpdateFranchiseRequest;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Read/write operations for the franchises (teams) domain: the league table, franchise detail and
 * stats, rosters, played-matches history, plus admin create/update and roster assignment.
 */
@Service
public class FranchiseService {

    private final FranchiseRepository franchiseRepository;
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;
    private final MatchParticipantRepository matchParticipantRepository;
    private final ResultRowRepository resultRowRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public FranchiseService(FranchiseRepository franchiseRepository,
                            PlayerRepository playerRepository,
                            UserRepository userRepository,
                            MatchParticipantRepository matchParticipantRepository,
                            ResultRowRepository resultRowRepository,
                            NotificationService notificationService,
                            AuditService auditService) {
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    // ---- queries ----

    /**
     * League table / standings. Starts from the points-sorted listing, then applies optional
     * {@code active} and {@code seasonId} filters before paginating.
     */
    @Cacheable(CacheConfig.FRANCHISES)
    @Transactional(readOnly = true)
    public PageResponse<FranchiseSummary> list(Boolean active, String seasonId, Integer limit, String cursor) {
        List<FranchiseSummary> rows = franchiseRepository.findAllByOrderByPointsDescNameAsc().stream()
                .filter(f -> active == null || f.isActive() == active)
                .filter(f -> seasonId == null || seasonId.equals(f.getSeasonId()))
                .map(this::toSummary)
                .toList();
        return Cursors.paginate(rows, cursor, limit);
    }

    /** Full detail (with stats) for a single franchise. */
    @Transactional(readOnly = true)
    public FranchiseDetail get(String id) {
        return toDetail(require(id));
    }

    /** The players currently on a franchise's roster. */
    @Transactional(readOnly = true)
    public List<RosterMember> roster(String id) {
        Franchise franchise = require(id);
        return rosterOf(franchise);
    }

    /** Matches the franchise has played, newest first, with its result line if published. */
    @Transactional(readOnly = true)
    public List<FranchiseMatchView> matches(String id) {
        Franchise franchise = require(id);
        UUID franchiseId = franchise.getId();
        return matchParticipantRepository.findByFranchiseId(franchiseId).stream()
                .map(MatchParticipant::getMatch)
                .map(match -> toMatchView(match, franchiseId))
                .sorted(Comparator.comparing(FranchiseMatchView::scheduledAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    // ---- mutations (admin) ----

    /** Create a franchise with zeroed standings and {@code active = true}. */
    @CacheEvict(value = CacheConfig.FRANCHISES, allEntries = true)
    @Transactional
    public FranchiseDetail create(CreateFranchiseRequest req) {
        Franchise franchise = new Franchise();
        franchise.setName(req.name());
        franchise.setTag(req.tag());
        franchise.setSeasonId(req.seasonId());
        franchise.setLogoUrl(req.logoUrl());
        franchise.setPoints(0);
        franchise.setRank(0);
        franchise.setActive(true);
        Franchise saved = franchiseRepository.save(franchise);

        auditService.record("franchise.create", "Franchise", saved.getId().toString(), saved.getName());
        return toDetail(saved);
    }

    /** Apply the non-null fields of the update; optionally (re)assign the in-game leader. */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail update(String id, UpdateFranchiseRequest req) {
        Franchise franchise = require(id);

        if (req.name() != null) {
            franchise.setName(req.name());
        }
        if (req.tag() != null) {
            franchise.setTag(req.tag());
        }
        if (req.logoUrl() != null) {
            franchise.setLogoUrl(req.logoUrl());
        }
        if (req.points() != null) {
            franchise.setPoints(req.points());
        }
        if (req.active() != null) {
            franchise.setActive(req.active());
        }
        if (req.iglPlayerId() != null) {
            Player igl = requirePlayer(req.iglPlayerId());
            franchise.setIglPlayer(igl);
        }

        Franchise saved = franchiseRepository.save(franchise);
        auditService.record("franchise.update", "Franchise", saved.getId().toString(), saved.getName());
        return toDetail(saved);
    }

    /** Assign a player to the franchise's roster and return the updated roster. */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public List<RosterMember> assignPlayer(String id, AssignPlayerRequest req) {
        Franchise franchise = require(id);
        Player player = requirePlayer(req.playerId());

        player.setFranchise(franchise);
        playerRepository.save(player);

        auditService.record("franchise.roster.assign", "Franchise", franchise.getId().toString(), req.playerId());
        return rosterOf(franchise);
    }

    /**
     * Admin: elevate a player to franchise owner. The owner is added to the roster, granted the
     * {@code FRANCHISE_OWNER} role (which carries manager permissions), and notified.
     */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail setOwner(String id, AssignRoleRequest req) {
        Franchise franchise = require(id);
        Player player = requirePlayer(req.playerId());

        franchise.setOwnerPlayer(player);
        player.setFranchise(franchise);
        playerRepository.save(player);
        elevateRole(player, Role.FRANCHISE_OWNER);
        Franchise saved = franchiseRepository.save(franchise);

        notify(player, "You're now a franchise owner",
                "You were made owner of " + franchise.getName() + ".");
        auditService.record("franchise.owner.set", "Franchise", saved.getId().toString(),
                player.getGamerTag() + " is now owner of " + saved.getName());
        return toDetail(saved);
    }

    /**
     * Set the franchise manager (one per franchise). Allowed for an admin or the franchise's owner.
     * The manager is added to the roster, granted the {@code FRANCHISE_MANAGER} role (unless they are
     * already an owner/admin), and notified.
     */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail setManager(String id, AssignRoleRequest req) {
        Franchise franchise = require(id);
        requireOwnerOrAdmin(franchise);
        Player player = requirePlayer(req.playerId());

        franchise.setManagerPlayer(player);
        player.setFranchise(franchise);
        playerRepository.save(player);
        // Raise-only: leaves an owner/admin acting as manager at their higher role.
        elevateRole(player, Role.FRANCHISE_MANAGER);
        Franchise saved = franchiseRepository.save(franchise);

        notify(player, "You're now a franchise manager",
                "You were made manager of " + franchise.getName() + ".");
        auditService.record("franchise.manager.set", "Franchise", saved.getId().toString(),
                player.getGamerTag() + " is now manager of " + saved.getName());
        return toDetail(saved);
    }

    /** Admin: discard (deactivate) a franchise so it no longer competes; history is preserved. */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail discard(String id) {
        Franchise franchise = require(id);
        franchise.setActive(false);
        Franchise saved = franchiseRepository.save(franchise);
        auditService.record("franchise.discard", "Franchise", saved.getId().toString(),
                "Discarded " + saved.getName());
        return toDetail(saved);
    }

    // ---- helpers ----

    /**
     * Raise the player's user account to {@code role} — only ever upward in the role hierarchy
     * (PLAYER &lt; FRANCHISE_MANAGER &lt; FRANCHISE_OWNER &lt; ADMIN), so it never demotes an admin or an
     * owner who is also given a lesser franchise role.
     */
    private void elevateRole(Player player, Role role) {
        User user = player.getUser();
        if (user != null && role.ordinal() > user.getRole().ordinal()) {
            user.setRole(role);
            userRepository.save(user);
        }
    }

    /** Require the current caller to be an admin or the owner of this franchise. */
    private void requireOwnerOrAdmin(Franchise franchise) {
        if (SecurityUtils.isAdmin()) {
            return;
        }
        Player owner = franchise.getOwnerPlayer();
        boolean isOwner = owner != null && owner.getUser() != null
                && owner.getUser().getId().equals(SecurityUtils.currentUserId());
        if (!isOwner) {
            throw ApiException.forbidden("Only the franchise owner or an admin can do this");
        }
    }

    private void notify(Player player, String title, String body) {
        if (player.getUser() != null) {
            notificationService.create(player.getUser(), NotificationType.GENERAL, title, body,
                    "/franchise/" + (player.getFranchise() != null
                            ? player.getFranchise().getId() : ""));
        }
    }

    /** Load a franchise by its string id, or throw 404 (an unparseable id can never match). */
    private Franchise require(String id) {
        return franchiseRepository.findById(parseId(id, "Franchise"))
                .orElseThrow(() -> ApiException.notFound("Franchise", id));
    }

    /** Load a player by its string id, or throw 404 (an unparseable id can never match). */
    private Player requirePlayer(String id) {
        return playerRepository.findById(parseId(id, "Player"))
                .orElseThrow(() -> ApiException.notFound("Player", id));
    }

    private static UUID parseId(String id, String resource) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound(resource, id);
        }
    }

    private List<RosterMember> rosterOf(Franchise franchise) {
        Player igl = franchise.getIglPlayer();
        UUID iglId = igl != null ? igl.getId() : null;
        return playerRepository.findByFranchiseId(franchise.getId()).stream()
                .map(p -> new RosterMember(
                        p.getId().toString(),
                        p.getGamerTag(),
                        p.getAvatarUrl(),
                        p.getStatus() != null ? p.getStatus().name() : null,
                        iglId != null && iglId.equals(p.getId())))
                .toList();
    }

    private FranchiseSummary toSummary(Franchise f) {
        return new FranchiseSummary(
                f.getId().toString(),
                f.getName(),
                f.getTag(),
                f.getLogoUrl(),
                f.getPoints(),
                f.getRank(),
                f.isActive(),
                f.getSeasonId(),
                playerRepository.countByFranchiseId(f.getId()));
    }

    private FranchiseDetail toDetail(Franchise f) {
        Player igl = f.getIglPlayer();
        FranchiseDetail.IglView iglView = igl != null
                ? new FranchiseDetail.IglView(igl.getId().toString(), igl.getGamerTag())
                : null;
        FranchiseDetail.PersonView ownerView = personView(f.getOwnerPlayer());
        FranchiseDetail.PersonView managerView = personView(f.getManagerPlayer());
        return new FranchiseDetail(
                f.getId().toString(),
                f.getName(),
                f.getTag(),
                f.getLogoUrl(),
                f.getPoints(),
                f.getRank(),
                f.isActive(),
                f.getSeasonId(),
                iglView,
                ownerView,
                managerView,
                playerRepository.countByFranchiseId(f.getId()),
                matchParticipantRepository.findByFranchiseId(f.getId()).size());
    }

    private static FranchiseDetail.PersonView personView(Player p) {
        return p == null ? null : new FranchiseDetail.PersonView(p.getId().toString(), p.getGamerTag());
    }

    private FranchiseMatchView toMatchView(Match match, UUID franchiseId) {
        ResultRow row = resultRowRepository.findByMatchIdOrderByRankAsc(match.getId()).stream()
                .filter(r -> r.getFranchise() != null && franchiseId.equals(r.getFranchise().getId()))
                .findFirst()
                .orElse(null);
        Integer rank = row != null ? row.getRank() : null;
        Integer total = row != null ? row.getTotal() : null;
        String gameName = match.getGame() != null ? match.getGame().getName() : null;
        return new FranchiseMatchView(
                match.getId().toString(),
                gameName,
                match.getScheduledAt(),
                match.getStatus() != null ? match.getStatus().name() : null,
                rank,
                total);
    }
}
