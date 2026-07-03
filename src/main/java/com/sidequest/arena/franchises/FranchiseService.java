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
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.seasons.SeasonService;
import com.sidequest.arena.seasons.dto.SeasonView;
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
    private final RegistrationRepository registrationRepository;
    private final NotificationService notificationService;
    private final SeasonService seasonService;
    private final AuditService auditService;

    public FranchiseService(FranchiseRepository franchiseRepository,
                            PlayerRepository playerRepository,
                            UserRepository userRepository,
                            MatchParticipantRepository matchParticipantRepository,
                            ResultRowRepository resultRowRepository,
                            RegistrationRepository registrationRepository,
                            NotificationService notificationService,
                            SeasonService seasonService,
                            AuditService auditService) {
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.registrationRepository = registrationRepository;
        this.notificationService = notificationService;
        this.seasonService = seasonService;
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
     * Admin: elevate a player to franchise owner. The owner is a roster member, so the player is
     * added to the roster, granted the {@code FRANCHISE_OWNER} role (which carries manager
     * permissions), and notified. The player must be free (unassigned) or already on this franchise,
     * and — once a season is running — the owner can only be (re)assigned between seasons.
     */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail setOwner(String id, AssignRoleRequest req) {
        Franchise franchise = require(id);
        Player player = requirePlayer(req.playerId());

        requireBetweenSeasons(franchise.getOwnerPlayer());
        requireEligible(player, franchise);

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

        requireBetweenSeasons(franchise.getManagerPlayer());
        requireEligible(player, franchise);

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

    /**
     * Admin: turn an approved-in-principle franchise-creation proposal (a {@code FRANCHISE}
     * {@link Registration}) into a real franchise. The proposal's squad name becomes the franchise
     * name with a derived tag, it is scoped to the current active season, the applying player is
     * made owner (added to the roster and elevated to {@code FRANCHISE_OWNER}), the registration is
     * marked APPROVED, and the applicant is notified. Discarding a proposal is the existing
     * registrations reject flow.
     */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail createFromProposal(UUID registrationId) {
        Registration registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> ApiException.notFound("Registration", registrationId));
        if (registration.getType() != RegistrationType.FRANCHISE) {
            throw ApiException.badRequest("Registration is not a franchise proposal");
        }
        if (registration.getStatus() == RegistrationStatus.APPROVED) {
            throw ApiException.conflict("This proposal has already been approved");
        }
        Player applicant = registration.getPlayer();
        if (applicant == null) {
            throw ApiException.badRequest("Franchise proposal has no applicant player");
        }
        // The applicant becomes the new franchise's owner, so they must be free — a player already on
        // another franchise cannot found a second one (mirrors the setOwner/setManager eligibility rule).
        if (applicant.getFranchise() != null) {
            throw ApiException.badRequest(
                    "Applicant already belongs to a franchise and cannot found a new one");
        }
        String name = registration.getSquadName();
        if (name == null || name.isBlank()) {
            throw ApiException.badRequest("Franchise proposal has no name");
        }

        SeasonView current = seasonService.current();

        Franchise franchise = new Franchise();
        franchise.setName(name.trim());
        franchise.setTag(deriveTag(name));
        franchise.setSeasonId(current != null ? current.code() : null);
        franchise.setPoints(0);
        franchise.setRank(0);
        franchise.setActive(true);
        franchise.setOwnerPlayer(applicant);
        Franchise saved = franchiseRepository.save(franchise);

        applicant.setFranchise(saved);
        playerRepository.save(applicant);
        elevateRole(applicant, Role.FRANCHISE_OWNER);

        registration.setStatus(RegistrationStatus.APPROVED);
        registrationRepository.save(registration);

        notify(applicant, "Franchise approved",
                "Your franchise '" + saved.getName() + "' was created. You're the owner.");
        auditService.record("franchise.fromProposal", "Franchise", saved.getId().toString(),
                "Created " + saved.getName() + " from proposal " + registrationId);
        return toDetail(saved);
    }

    /**
     * Admin: candidate players for a franchise's owner/manager slot — verified players who are
     * unassigned or already on this franchise. 404 if the franchise does not exist.
     */
    @Transactional(readOnly = true)
    public List<FranchiseDetail.PersonView> eligiblePlayers(UUID franchiseId) {
        franchiseRepository.findById(franchiseId)
                .orElseThrow(() -> ApiException.notFound("Franchise", franchiseId));
        return playerRepository.findByStatus(PlayerStatus.VERIFIED).stream()
                .filter(p -> p.getFranchise() == null
                        || p.getFranchise().getId().equals(franchiseId))
                .map(p -> new FranchiseDetail.PersonView(p.getId().toString(), p.getGamerTag()))
                .toList();
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

    /**
     * A player is eligible for a franchise role only if they are unassigned or already on this
     * franchise (owner/manager are roster members). Otherwise they belong to another franchise.
     */
    private void requireEligible(Player player, Franchise franchise) {
        Franchise existing = player.getFranchise();
        if (existing != null && !existing.getId().equals(franchise.getId())) {
            throw ApiException.badRequest("Player already belongs to another franchise");
        }
    }

    /**
     * Owner/manager may only be changed once a slot has been filled if there is no active season
     * (i.e. between seasons). First-time assignment (an empty slot) is always allowed.
     */
    private void requireBetweenSeasons(Player currentSlot) {
        boolean firstTime = currentSlot == null;
        boolean seasonActive = seasonService.current() != null;
        if (!firstTime && seasonActive) {
            throw ApiException.badRequest("Owner and manager can only be changed between seasons");
        }
    }

    /** Derive a short tag (uppercase, first ~3 alpha chars) from a franchise/proposal name. */
    private static String deriveTag(String name) {
        StringBuilder sb = new StringBuilder(3);
        if (name != null) {
            for (int i = 0; i < name.length() && sb.length() < 3; i++) {
                char c = name.charAt(i);
                if (Character.isLetter(c)) {
                    sb.append(Character.toUpperCase(c));
                }
            }
        }
        return sb.length() > 0 ? sb.toString() : "TBD";
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
