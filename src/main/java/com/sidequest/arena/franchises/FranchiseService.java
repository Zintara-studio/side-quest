package com.sidequest.arena.franchises;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.franchises.dto.AssignPlayerRequest;
import com.sidequest.arena.franchises.dto.AssignRoleRequest;
import com.sidequest.arena.franchises.dto.CreateFranchiseRequest;
import com.sidequest.arena.franchises.dto.FranchiseDetail;
import com.sidequest.arena.franchises.dto.FranchiseInviteRequest;
import com.sidequest.arena.franchises.dto.FranchiseInviteView;
import com.sidequest.arena.franchises.dto.FranchiseMatchView;
import com.sidequest.arena.franchises.dto.FranchiseMineView;
import com.sidequest.arena.franchises.dto.FranchiseSummary;
import com.sidequest.arena.franchises.dto.RosterMember;
import com.sidequest.arena.franchises.dto.UpdateFranchiseRequest;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.FranchiseInvite;
import com.sidequest.arena.model.FranchiseRole;
import com.sidequest.arena.model.InviteStatus;
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
import com.sidequest.arena.repo.FranchiseInviteRepository;
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
    private final FranchiseInviteRepository franchiseInviteRepository;
    private final NotificationService notificationService;
    private final SeasonService seasonService;
    private final AuditService auditService;

    public FranchiseService(FranchiseRepository franchiseRepository,
                            PlayerRepository playerRepository,
                            UserRepository userRepository,
                            MatchParticipantRepository matchParticipantRepository,
                            ResultRowRepository resultRowRepository,
                            RegistrationRepository registrationRepository,
                            FranchiseInviteRepository franchiseInviteRepository,
                            NotificationService notificationService,
                            SeasonService seasonService,
                            AuditService auditService) {
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.registrationRepository = registrationRepository;
        this.franchiseInviteRepository = franchiseInviteRepository;
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
        return toDetail(applyOwner(franchise, player));
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
        return toDetail(applyManager(franchise, player));
    }

    /**
     * Shared owner-assignment sequence used by the admin direct-assign path and the invite-accept path.
     * Re-checks the season lock and eligibility (so a stale invite fails cleanly), sets the slot, adds
     * the player to the roster, elevates their role, notifies and audits. Returns the saved franchise.
     */
    private Franchise applyOwner(Franchise franchise, Player player) {
        requireBetweenSeasons(franchise.getOwnerPlayer());
        requireEligible(player, franchise);

        Player outgoing = franchise.getOwnerPlayer();
        franchise.setOwnerPlayer(player);
        player.setFranchise(franchise);
        playerRepository.save(player);
        elevateRole(player, Role.FRANCHISE_OWNER);
        Franchise saved = franchiseRepository.save(franchise);
        // Transferring ownership removes the previous owner from the roster (not a silent demotion).
        demoteOutgoingLeader(saved, outgoing, player);

        notify(player, "You're now a franchise owner",
                "You were made owner of " + franchise.getName() + ".");
        auditService.record("franchise.owner.set", "Franchise", saved.getId().toString(),
                player.getGamerTag() + " is now owner of " + saved.getName());
        return saved;
    }

    /**
     * Shared manager-assignment sequence used by the admin direct-assign path and the invite-accept
     * path. Re-checks the season lock and eligibility, sets the slot, adds the player to the roster,
     * raises their role (raise-only), notifies and audits. Returns the saved franchise.
     */
    private Franchise applyManager(Franchise franchise, Player player) {
        requireBetweenSeasons(franchise.getManagerPlayer());
        requireEligible(player, franchise);

        Player outgoing = franchise.getManagerPlayer();
        franchise.setManagerPlayer(player);
        player.setFranchise(franchise);
        playerRepository.save(player);
        // Raise-only: leaves an owner/admin acting as manager at their higher role.
        elevateRole(player, Role.FRANCHISE_MANAGER);
        Franchise saved = franchiseRepository.save(franchise);
        // Replacing the manager removes the previous manager from the roster (not a silent demotion).
        demoteOutgoingLeader(saved, outgoing, player);

        notify(player, "You're now a franchise manager",
                "You were made manager of " + franchise.getName() + ".");
        auditService.record("franchise.manager.set", "Franchise", saved.getId().toString(),
                player.getGamerTag() + " is now manager of " + saved.getName());
        return saved;
    }

    /**
     * When a leadership slot changes hands, the outgoing owner/manager is removed from the roster
     * entirely and their platform role is dropped back to {@code PLAYER}. They are kept only if they
     * still hold the franchise's other leadership slot (e.g. an owner who remains manager); admins are
     * never demoted. This is called after the new holder is set, so the slots already reflect the swap.
     */
    private void demoteOutgoingLeader(Franchise franchise, Player outgoing, Player replacement) {
        if (outgoing == null || outgoing.getId().equals(replacement.getId())) {
            return;
        }
        boolean stillLeads = matchesPlayer(franchise.getOwnerPlayer(), outgoing.getId())
                || matchesPlayer(franchise.getManagerPlayer(), outgoing.getId());
        if (stillLeads) {
            return;
        }
        outgoing.setFranchise(null);
        playerRepository.save(outgoing);
        demoteRole(outgoing);
        if (outgoing.getUser() != null) {
            notificationService.create(outgoing.getUser(), NotificationType.GENERAL,
                    "Franchise role ended",
                    "You are no longer part of " + franchise.getName() + ".", "/my/franchise");
        }
        auditService.record("franchise.leader.remove", "Franchise", franchise.getId().toString(),
                outgoing.getGamerTag() + " was removed from " + franchise.getName());
    }

    /** Drop a removed leader's platform role back to PLAYER (never an admin, never re-raises). */
    private void demoteRole(Player player) {
        User user = player.getUser();
        if (user != null && user.getRole() != Role.ADMIN && user.getRole() != Role.PLAYER) {
            user.setRole(Role.PLAYER);
            userRepository.save(user);
        }
    }

    /**
     * Admin: discard (deactivate) a franchise so it no longer competes; history is preserved. Only
     * allowed between seasons — a franchise cannot be pulled out mid-season. A discarded franchise can
     * be brought back with {@link #restore(String)} (useful when a franchise sits out a single season).
     */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail discard(String id) {
        Franchise franchise = require(id);
        if (seasonService.current() != null) {
            throw ApiException.badRequest(
                    "A franchise can't be discarded during an active season — finish the season first");
        }
        franchise.setActive(false);
        Franchise saved = franchiseRepository.save(franchise);
        auditService.record("franchise.discard", "Franchise", saved.getId().toString(),
                "Discarded " + saved.getName());
        return toDetail(saved);
    }

    /** Admin: bring a previously discarded franchise back into the league (between seasons). */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseDetail restore(String id) {
        Franchise franchise = require(id);
        franchise.setActive(true);
        Franchise saved = franchiseRepository.save(franchise);
        auditService.record("franchise.restore", "Franchise", saved.getId().toString(),
                "Restored " + saved.getName());
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
        Franchise franchise = franchiseRepository.findById(franchiseId)
                .orElseThrow(() -> ApiException.notFound("Franchise", franchiseId));
        // Admin, or THIS franchise's owner (so an owner of another franchise can't read this list).
        requireOwnerOrAdmin(franchise);
        return playerRepository.findByStatus(PlayerStatus.VERIFIED).stream()
                .filter(p -> p.getFranchise() == null
                        || p.getFranchise().getId().equals(franchiseId))
                .map(p -> new FranchiseDetail.PersonView(p.getId().toString(), p.getGamerTag()))
                .toList();
    }

    // ---- owner/manager invites ----

    /**
     * The franchise owner (or an admin) invites a player to become the new owner (ownership transfer)
     * or the manager. Fails fast if the invitee is ineligible or the target slot is season-locked (a
     * filled slot can only change between seasons). Re-opens a previously rejected invite for the same
     * (franchise, invitee) or creates a new pending one. The invitee is notified. Returns the invite.
     */
    @Transactional
    public FranchiseInviteView createInvite(String id, FranchiseInviteRequest req) {
        Franchise franchise = require(id);
        requireOwnerOrAdmin(franchise);
        if (req.role() == null) {
            throw ApiException.badRequest("A role (OWNER or MANAGER) is required");
        }
        Player invitee = resolveInvitee(req);

        // Fail fast so a doomed invite is never created: the invitee must be eligible and the target
        // slot must be changeable now (empty slot, or between seasons for a filled slot).
        requireEligible(invitee, franchise);
        requireBetweenSeasons(req.role() == FranchiseRole.OWNER
                ? franchise.getOwnerPlayer() : franchise.getManagerPlayer());

        Player inviter = currentInviter(franchise);

        FranchiseInvite invite = franchiseInviteRepository
                .findByFranchiseIdAndInvitedPlayerId(franchise.getId(), invitee.getId())
                .orElse(null);
        if (invite != null && invite.getStatus() == InviteStatus.PENDING) {
            throw ApiException.conflict(invitee.getGamerTag() + " already has a pending invite");
        }
        if (invite == null) {
            invite = new FranchiseInvite();
            invite.setFranchise(franchise);
            invite.setInvitedPlayer(invitee);
        }
        invite.setInvitedBy(inviter);
        invite.setRole(req.role());
        invite.setStatus(InviteStatus.PENDING);
        invite.setMessage(req.message());
        FranchiseInvite saved = franchiseInviteRepository.save(invite);

        if (invitee.getUser() != null) {
            notificationService.create(invitee.getUser(), NotificationType.GENERAL,
                    "Franchise invite",
                    "You were invited to be " + req.role().name().toLowerCase() + " of "
                            + franchise.getName() + ".", "/my/franchise");
        }
        auditService.record("franchise.invite.create", "Franchise", franchise.getId().toString(),
                "Invited " + invitee.getGamerTag() + " as " + req.role().name()
                        + " of " + franchise.getName());
        return toInviteView(saved);
    }

    /**
     * The invited player accepts or rejects a franchise owner/manager invite. Only the invitee may
     * respond, and only while pending. Accepting re-runs the shared owner/manager assignment (which
     * re-checks the season lock and eligibility, so a stale invite fails cleanly). The inviter is
     * notified either way.
     */
    @CacheEvict(cacheNames = {CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public FranchiseInviteView respondToInvite(String inviteId, boolean accept) {
        FranchiseInvite invite = loadInvite(inviteId);
        Player invitee = invite.getInvitedPlayer();

        if (invitee == null || invitee.getUser() == null
                || !invitee.getUser().getId().equals(SecurityUtils.currentUserId())) {
            throw ApiException.forbidden("You can only respond to your own invitations");
        }
        if (invite.getStatus() != InviteStatus.PENDING) {
            throw ApiException.conflict("This invitation has already been answered");
        }

        Franchise franchise = invite.getFranchise();
        if (accept) {
            // Re-runs the season-lock + eligibility checks; a stale invite fails cleanly here.
            if (invite.getRole() == FranchiseRole.OWNER) {
                applyOwner(franchise, invitee);
            } else {
                applyManager(franchise, invitee);
            }
        }
        invite.setStatus(accept ? InviteStatus.ACCEPTED : InviteStatus.REJECTED);
        FranchiseInvite saved = franchiseInviteRepository.save(invite);

        Player inviter = invite.getInvitedBy();
        if (inviter != null && inviter.getUser() != null) {
            notificationService.create(inviter.getUser(), NotificationType.GENERAL,
                    accept ? "Franchise invite accepted" : "Franchise invite declined",
                    invitee.getGamerTag() + (accept ? " accepted" : " declined")
                            + " the " + invite.getRole().name().toLowerCase() + " invite for "
                            + (franchise != null ? franchise.getName() : "your franchise") + ".",
                    "/my/franchise");
        }
        auditService.record(accept ? "franchise.invite.accept" : "franchise.invite.reject",
                "FranchiseInvite", saved.getId().toString(),
                invitee.getGamerTag() + (accept ? " accepted" : " declined")
                        + " a " + saved.getRole().name() + " invite");
        return toInviteView(saved);
    }

    /** Owner/manager invitations addressed to the current player (newest first). */
    @Transactional(readOnly = true)
    public List<FranchiseInviteView> myInvites() {
        Player player = playerRepository.findByUserId(SecurityUtils.currentUserId()).orElse(null);
        if (player == null) {
            return List.of();
        }
        return franchiseInviteRepository.findByInvitedPlayerIdOrderByCreatedAtDesc(player.getId()).stream()
                .map(FranchiseService::toInviteView)
                .toList();
    }

    /** Pending owner/manager invites a franchise has outstanding (owner/admin only). */
    @Transactional(readOnly = true)
    public List<FranchiseInviteView> franchisePendingInvites(String id) {
        Franchise franchise = require(id);
        requireOwnerOrAdmin(franchise);
        return franchiseInviteRepository
                .findByFranchiseIdAndStatusOrderByCreatedAtDesc(franchise.getId(), InviteStatus.PENDING)
                .stream()
                .map(FranchiseService::toInviteView)
                .toList();
    }

    /**
     * The current user's franchise and the role they hold on it, for the "my franchise" screen.
     * Returns {@code null} when the caller is not a player or does not belong to a franchise.
     */
    @Transactional(readOnly = true)
    public FranchiseMineView myFranchise() {
        Player player = playerRepository.findByUserId(SecurityUtils.currentUserId()).orElse(null);
        if (player == null || player.getFranchise() == null) {
            return null;
        }
        Franchise franchise = player.getFranchise();
        String myRole = roleOf(player, franchise);
        return new FranchiseMineView(toDetail(franchise), myRole);
    }

    // ---- helpers ----

    /** The current player standing in as the inviter, or the franchise owner when an admin invites. */
    private Player currentInviter(Franchise franchise) {
        Player me = playerRepository.findByUserId(SecurityUtils.currentUserId()).orElse(null);
        if (me != null) {
            return me;
        }
        // An admin without a player profile falls back to the franchise owner as the invite's sender.
        Player owner = franchise.getOwnerPlayer();
        if (owner != null) {
            return owner;
        }
        throw ApiException.badRequest("No player profile to send the invite from");
    }

    /** Resolve the invitee by player id or gamer tag (mirrors the squad-invite resolver). */
    private Player resolveInvitee(FranchiseInviteRequest request) {
        if (request.playerId() != null && !request.playerId().isBlank()) {
            return playerRepository.findById(parseId(request.playerId(), "Player"))
                    .orElseThrow(() -> ApiException.notFound("Player", request.playerId()));
        }
        if (request.gamerTag() != null && !request.gamerTag().isBlank()) {
            return playerRepository.findByGamerTagIgnoreCase(request.gamerTag().trim())
                    .orElseThrow(() -> ApiException.notFound("Player", request.gamerTag()));
        }
        throw ApiException.badRequest("Provide a gamerTag or playerId to invite");
    }

    /** The caller's role on a franchise: OWNER &gt; MANAGER &gt; PLAYER. */
    private static String roleOf(Player player, Franchise franchise) {
        UUID pid = player.getId();
        if (matchesPlayer(franchise.getOwnerPlayer(), pid)) {
            return "OWNER";
        }
        if (matchesPlayer(franchise.getManagerPlayer(), pid)) {
            return "MANAGER";
        }
        return "PLAYER";
    }

    private static boolean matchesPlayer(Player slot, UUID playerId) {
        return slot != null && slot.getId().equals(playerId);
    }

    private FranchiseInvite loadInvite(String id) {
        return franchiseInviteRepository.findById(parseId(id, "FranchiseInvite"))
                .orElseThrow(() -> ApiException.notFound("FranchiseInvite", id));
    }

    private static FranchiseInviteView toInviteView(FranchiseInvite invite) {
        Franchise f = invite.getFranchise();
        Player invitedBy = invite.getInvitedBy();
        Player invited = invite.getInvitedPlayer();
        return new FranchiseInviteView(
                invite.getId().toString(),
                f == null ? null : f.getId().toString(),
                f == null ? null : f.getName(),
                f == null ? null : f.getTag(),
                invite.getRole() == null ? null : invite.getRole().name(),
                invitedBy == null ? null : invitedBy.getGamerTag(),
                invited == null ? null : invited.getGamerTag(),
                invite.getStatus() == null ? null : invite.getStatus().name(),
                invite.getMessage(),
                invite.getCreatedAt());
    }

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
        return playerRepository.findByFranchiseId(franchise.getId()).stream()
                .map(p -> new RosterMember(
                        p.getId().toString(),
                        p.getGamerTag(),
                        p.getAvatarUrl(),
                        p.getStatus() != null ? p.getStatus().name() : null,
                        roleOf(p, franchise)))
                // Leaders first (OWNER, then MANAGER), then the rest.
                .sorted(Comparator.comparingInt(FranchiseService::rosterRoleOrder))
                .toList();
    }

    private static int rosterRoleOrder(RosterMember m) {
        return switch (m.role() == null ? "" : m.role()) {
            case "OWNER" -> 0;
            case "MANAGER" -> 1;
            default -> 2;
        };
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
        return new FranchiseDetail(
                f.getId().toString(),
                f.getName(),
                f.getTag(),
                f.getLogoUrl(),
                f.getPoints(),
                f.getRank(),
                f.isActive(),
                f.getSeasonId(),
                personView(f.getOwnerPlayer()),
                personView(f.getManagerPlayer()),
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
