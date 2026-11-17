package com.sidequest.arena.registrations;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.InviteStatus;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AuctionStatus;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.model.TeamInvite;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.players.PlayerProfileWriter;
import com.sidequest.arena.realtime.RealtimeService;
import com.sidequest.arena.registrations.dto.ApplyRequest;
import com.sidequest.arena.registrations.dto.InviteRequest;
import com.sidequest.arena.registrations.dto.InviteView;
import com.sidequest.arena.registrations.dto.RegistrationView;
import com.sidequest.arena.registrations.dto.ReviewRequest;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.AnnouncementRepository;
import com.sidequest.arena.repo.AuctionRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.SeasonRepository;
import com.sidequest.arena.repo.TeamInviteRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * League registration / approval-queue logic: applying as a player or squad, the squad-invite flow
 * (captain invites teammates, who accept/reject), the player's own registration/invite views, and the
 * admin approval queue with approve / reject review actions. Events fan out as durable in-app
 * notifications, realtime pushes and audit entries.
 */
@Service
public class RegistrationService {

    /** Fallback squad size when a SQUAD registration/announcement did not specify one. */
    private static final int DEFAULT_SQUAD_SIZE = 5;

    private final RegistrationRepository registrationRepository;
    private final AnnouncementRepository announcementRepository;
    private final AuctionRepository auctionRepository;
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;
    private final TeamInviteRepository teamInviteRepository;
    private final MatchRepository matchRepository;
    private final GameRepository gameRepository;
    private final LeagueSettingsRepository leagueSettingsRepository;
    private final SeasonRepository seasonRepository;
    private final PlayerProfileWriter profileWriter;
    private final RealtimeService realtimeService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public RegistrationService(RegistrationRepository registrationRepository,
                               AnnouncementRepository announcementRepository,
                               AuctionRepository auctionRepository,
                               PlayerRepository playerRepository,
                               UserRepository userRepository,
                               TeamInviteRepository teamInviteRepository,
                               MatchRepository matchRepository,
                               GameRepository gameRepository,
                               LeagueSettingsRepository leagueSettingsRepository,
                               SeasonRepository seasonRepository,
                               PlayerProfileWriter profileWriter,
                               RealtimeService realtimeService,
                               NotificationService notificationService,
                               AuditService auditService) {
        this.registrationRepository = registrationRepository;
        this.announcementRepository = announcementRepository;
        this.auctionRepository = auctionRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.teamInviteRepository = teamInviteRepository;
        this.matchRepository = matchRepository;
        this.gameRepository = gameRepository;
        this.leagueSettingsRepository = leagueSettingsRepository;
        this.seasonRepository = seasonRepository;
        this.profileWriter = profileWriter;
        this.realtimeService = realtimeService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    /** Whether a season is currently ACTIVE — franchise proposals are only accepted between seasons. */
    private boolean seasonActive() {
        return seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE).isPresent();
    }

    /**
     * Apply to the league on behalf of the current user. Match registrations (PLAYER solo / SQUAD) are
     * live immediately — a SQUAD starts FORMING (captain invites teammates until the lock), a solo entry
     * starts ACTIVE — with no admin approval step. AUCTION entries go ACTIVE into the standing pool.
     * FRANCHISE-creation proposals stay PENDING for admin curation. AUCTION and FRANCHISE require a
     * VERIFIED account (non-verified players may only enter FFA/solo/squad games); current franchise
     * members can't enter the auction. A player can't open their own team for a match they've already
     * joined another team for.
     */
    @Transactional
    public RegistrationView apply(ApplyRequest request) {
        // SQUAD and FRANCHISE applications carry a proposed name; PLAYER and AUCTION do not.
        boolean needsName = request.type() == RegistrationType.SQUAD
                || request.type() == RegistrationType.FRANCHISE;
        if (needsName && (request.squadName() == null || request.squadName().isBlank())) {
            throw ApiException.badRequest(
                    request.type() == RegistrationType.FRANCHISE
                            ? "a franchise name is required for franchise registrations"
                            : "squadName is required for squad registrations");
        }

        // Row-lock the applicant: every exclusivity guard below (one live entry per match, one team per
        // match, one pool entry) is check-then-act, so two racing applies for the same player must
        // serialize — the loser re-reads committed state and hits the normal 409s.
        Player player = playerRepository.lockById(currentPlayer().getId())
                .orElseThrow(() -> ApiException.notFound("Player", "current"));

        // If this entry is responding to a specific registration call, that call must still be open —
        // a stale link (closed/deleted call) can't submit past the UI. This is the authoritative guard.
        if (request.announcementId() != null && !request.announcementId().isBlank()) {
            // The register link now carries the announcement's short code; still accept a legacy UUID.
            String ref = request.announcementId();
            Announcement call = announcementRepository.findByShortCode(ref).or(() -> {
                try {
                    return announcementRepository.findById(UUID.fromString(ref));
                } catch (IllegalArgumentException notAUuid) {
                    return java.util.Optional.empty();
                }
            }).orElse(null);
            if (call == null || !call.isRegistrationOpen()) {
                throw ApiException.badRequest("This registration call has closed.");
            }
        }

        // Verification gate: auctions and franchise creation are for verified accounts only; anyone may
        // still enter FFA/solo/squad games. (Verification will be automated via email; today it's set by
        // an admin on the player's status.)
        if ((request.type() == RegistrationType.AUCTION || request.type() == RegistrationType.FRANCHISE)
                && player.getStatus() != PlayerStatus.VERIFIED) {
            throw ApiException.forbidden(request.type() == RegistrationType.AUCTION
                    ? "Only verified accounts can enter the auction — verify your account first."
                    : "Only verified accounts can create a franchise — verify your account first.");
        }
        // A current franchise owner/manager/rostered player cannot enter the auction pool.
        if (request.type() == RegistrationType.AUCTION && player.getFranchise() != null) {
            throw ApiException.badRequest(
                    "You're already on a franchise — franchise members can't enter the auction.");
        }
        // Franchise proposals may only be submitted between seasons — mirror the promotion gate at the
        // submission boundary so proposals can't pile up mid-season.
        if (request.type() == RegistrationType.FRANCHISE && seasonActive()) {
            throw ApiException.badRequest(
                    "Franchise proposals can only be submitted between seasons — a season is currently active.");
        }
        // Auction pool and franchise proposal are mutually exclusive. A player who's in the auction pool
        // cannot ALSO propose a franchise — block it. (The reverse — entering the pool while a proposal
        // is pending — auto-withdraws that proposal in the AUCTION branch below; auction takes priority.)
        if (request.type() == RegistrationType.FRANCHISE) {
            boolean pooled = registrationRepository.findByPlayerId(player.getId()).stream()
                    .anyMatch(r -> r.getType() == RegistrationType.AUCTION
                            && r.getStatus() == RegistrationStatus.ACTIVE && !r.isConsumed());
            if (pooled) {
                throw ApiException.conflict(
                        "You're in the auction pool — withdraw from it before proposing a franchise.");
            }
        }
        // Auction registration closes the moment an admin locks the pool for the upcoming auction.
        if (request.type() == RegistrationType.AUCTION
                && auctionRepository.existsByPoolLockedAtIsNotNullAndStatusNot(AuctionStatus.COMPLETED)) {
            throw ApiException.badRequest(
                    "Auction registration is closed — the pool has been locked for the upcoming auction.");
        }
        // A player can only sit in the auction pool once: block a duplicate live, unconsumed entry.
        if (request.type() == RegistrationType.AUCTION) {
            boolean alreadyPooled = registrationRepository.findByPlayerId(player.getId()).stream()
                    .anyMatch(r -> r.getType() == RegistrationType.AUCTION
                            && r.getStatus() == RegistrationStatus.ACTIVE && !r.isConsumed());
            if (alreadyPooled) {
                throw ApiException.conflict("You're already in the auction pool.");
            }
            // Entering the pool supersedes any pending franchise proposal (mutually exclusive) — auto-
            // withdraw it so the player is never in both. Auction is the priority per the league rules.
            for (Registration reg : registrationRepository.findByPlayerId(player.getId())) {
                if (reg.getType() == RegistrationType.FRANCHISE
                        && reg.getStatus() == RegistrationStatus.PENDING) {
                    voidRegistration(reg, RegistrationStatus.WITHDRAWN,
                            "Auto-withdrawn — you entered the auction pool.");
                }
            }
        }
        // Every non-franchise entry needs at least one game (franchise proposals carry no games).
        if (request.type() != RegistrationType.FRANCHISE
                && (request.games() == null || request.games().isEmpty())) {
            throw ApiException.badRequest("Select at least one game for this registration");
        }

        Registration registration = new Registration();
        registration.setType(request.type());
        registration.setPlayer(player);
        registration.setSquadName(request.squadName());
        if (request.type() == RegistrationType.FRANCHISE) {
            registration.setFranchiseTag(normalizeTag(request.franchiseTag()));
        }
        registration.setGames(request.games() == null
                ? new ArrayList<>() : new ArrayList<>(request.games()));
        registration.setContact(request.contact());

        // Capture the applicant's real name onto their profile so franchises/admins know who they're
        // registering / drafting. Kept private (realNamePublic is untouched) — auction visibility is
        // gated per-viewer by the scout check, not by the public flag.
        if (request.realName() != null && !request.realName().isBlank()) {
            player.setRealName(request.realName().trim());
        }
        if (request.type() == RegistrationType.SQUAD) {
            registration.setTeamSize(request.teamSize());
        }
        // Keep the applicant's free-form note where admins can see it.
        if (request.note() != null && !request.note().isBlank()) {
            registration.setReason(request.note().trim());
        }
        // SQUAD → FORMING (open for invites); PLAYER/AUCTION → ACTIVE (registered); FRANCHISE → PENDING.
        boolean forming = request.type() == RegistrationType.SQUAD;
        registration.setStatus(switch (request.type()) {
            case SQUAD -> RegistrationStatus.FORMING;
            case FRANCHISE -> RegistrationStatus.PENDING;
            default -> RegistrationStatus.ACTIVE;
        });

        Game game = null;
        if (request.matchId() != null && !request.matchId().isBlank()) {
            Match match = matchRepository.findById(parseId(request.matchId(), "Match"))
                    .orElseThrow(() -> ApiException.notFound("Match", request.matchId()));

            // Prevent duplicate entries: a player may only have one live registration per match.
            boolean alreadyEntered = registrationRepository
                    .findByPlayerIdAndMatchId(player.getId(), match.getId()).stream()
                    .anyMatch(r -> isLive(r.getStatus()));
            if (alreadyEntered) {
                throw ApiException.conflict("You have already registered for this match");
            }
            // Single-team exclusivity: can't open your own team for a match you've already joined.
            if (hasAcceptedTeamFor(player.getId(), match.getId(), null)) {
                throw ApiException.conflict(
                        "You've already joined a team for this match — you can't register another entry.");
            }

            // Registration locks a configurable number of hours before the scheduled start.
            if (matchLocked(match)) {
                throw ApiException.badRequest(
                        "Registration is closed — it locks " + lockHours() + " hours before match time");
            }

            registration.setMatch(match);
            // Derive the game from the linked match so the frontend needs no manual picker.
            game = match.getGame();
        }
        // Fall back to the explicit game hint (season / general calls with no match).
        if (game == null && request.gameId() != null) {
            game = gameRepository.findById(request.gameId())
                    .orElseThrow(() -> ApiException.notFound("Game", request.gameId()));
        }
        registration.setGame(game);

        // General (non-match) PLAYER/SQUAD sign-ups get the same duplicate guard as match entries —
        // without it a player could re-submit the same open call indefinitely, piling up live rows.
        if (registration.getMatch() == null
                && (request.type() == RegistrationType.PLAYER || request.type() == RegistrationType.SQUAD)) {
            UUID gameId = game != null ? game.getId() : null;
            boolean duplicate = registrationRepository.findByPlayerId(player.getId()).stream()
                    .anyMatch(r -> r.getType() == request.type()
                            && r.getMatch() == null
                            && isLive(r.getStatus())
                            && ((r.getGame() == null && gameId == null)
                                    || (r.getGame() != null && r.getGame().getId().equals(gameId))));
            if (duplicate) {
                throw ApiException.conflict("You already have a live registration for this call.");
            }
        }

        Registration saved = registrationRepository.save(registration);

        String what = describe(saved);

        if (forming) {
            // A squad is live and open for invites — prompt the captain to build the roster before it locks.
            notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                    "Squad registered",
                    "Invite your teammates to '" + saved.getSquadName()
                            + "' before the roster locks.", "/my/registrations");
        } else if (request.type() == RegistrationType.FRANCHISE) {
            // Franchise proposals are still admin-curated — confirm to the applicant and notify admins.
            notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                    "Franchise proposal received",
                    "Your " + what + " proposal is awaiting admin review.", "/my/registrations");
            for (User admin : userRepository.findByRole(Role.ADMIN)) {
                notificationService.create(admin, NotificationType.REGISTRATION,
                        "New franchise proposal",
                        player.getGamerTag() + " proposed " + what + ".", "/admin/franchises");
            }
        } else {
            // Solo / auction entries are registered immediately — a simple confirmation, no approval queue.
            notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                    "You're registered",
                    "Your " + what + " registration is confirmed.", "/my/registrations");
        }

        // Upsert any self-reported per-game proficiency / handles onto the player's profile so the
        // auction pool (and player profile) reflects the applicant's declared skill. Applies to any
        // application that carries them, but primarily used by AUCTION entries. Routed through the same
        // canonical writer the profile-edit screen uses, so registration and edit can never diverge.
        // A newly-supplied handle is made public (the auction pool is scouted publicly); a BLANK handle
        // passes handlePublic=null so it never silently re-publicizes a handle the user set private.
        if (request.proficiencies() != null) {
            profileWriter.upsert(player, request.proficiencies().stream()
                    .filter(e -> e != null && e.gameId() != null)
                    .map(e -> new PlayerProfileWriter.Upsert(e.gameId(), e.rating(), e.handle(),
                            e.handle() != null && !e.handle().isBlank() ? Boolean.TRUE : null,
                            e.rankTier(), e.kd(), e.accountLevel()))
                    .toList());
        }

        auditService.record("registration.apply", "Registration", saved.getId().toString(),
                player.getGamerTag() + " registered " + what);

        return toView(saved);
    }

    /**
     * Admin approval queue, newest first, optionally filtered by status and/or type, then
     * paginated.
     */
    @Transactional(readOnly = true)
    public PageResponse<RegistrationView> list(RegistrationStatus status, RegistrationType type,
                                               Integer limit, String cursor) {
        List<Registration> registrations;
        if (status != null && type != null) {
            registrations = registrationRepository.findByStatusAndTypeOrderByCreatedAtDesc(status, type);
        } else if (status != null) {
            registrations = registrationRepository.findByStatusOrderByCreatedAtDesc(status);
        } else if (type != null) {
            registrations = registrationRepository.findByTypeOrderByCreatedAtDesc(type);
        } else {
            registrations = registrationRepository.findAllByOrderByCreatedAtDesc();
        }

        List<RegistrationView> views = registrations.stream()
                .map(this::toView)
                .toList();

        return Cursors.paginate(views, cursor, limit);
    }

    /** Full detail for a single registration (admin). */
    @Transactional(readOnly = true)
    public RegistrationView get(String id) {
        return toView(load(id));
    }

    /** The current player's own registrations (newest first), each with its squad roster. */
    @Transactional(readOnly = true)
    public List<RegistrationView> mine() {
        Player player = playerRepository.findByUserId(SecurityUtils.currentUserId()).orElse(null);
        if (player == null) {
            return List.of();
        }
        return registrationRepository.findByPlayerId(player.getId()).stream()
                .filter(r -> !r.isHidden()) // player-removed history stays out of their own list
                .sorted(Comparator.comparing(Registration::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toView)
                .toList();
    }

    /** Squad invitations addressed to the current player (newest first). */
    @Transactional(readOnly = true)
    public List<InviteView> myInvites() {
        Player player = playerRepository.findByUserId(SecurityUtils.currentUserId()).orElse(null);
        if (player == null) {
            return List.of();
        }
        return teamInviteRepository.findByInvitedPlayerIdOrderByCreatedAtDesc(player.getId()).stream()
                .map(this::toInviteView)
                .toList();
    }

    /**
     * Captain invites a teammate to their SQUAD registration. The invitee is resolved by gamer tag or
     * player id. Re-inviting a player who previously declined re-opens their invite. Only the captain of
     * a squad still being FORMED may invite (once submitted for approval the roster is locked). The
     * invited player is notified.
     */
    @Transactional
    public RegistrationView invite(String registrationId, InviteRequest request) {
        Registration registration = load(registrationId);
        Player captain = registration.getPlayer();

        if (registration.getType() != RegistrationType.SQUAD) {
            throw ApiException.badRequest("Only squad registrations can invite teammates");
        }
        if (captain == null || !captain.getUser().getId().equals(SecurityUtils.currentUserId())) {
            throw ApiException.forbidden("Only the squad captain can invite teammates");
        }
        if (registration.getStatus() != RegistrationStatus.FORMING) {
            throw ApiException.conflict(
                    "The roster is locked — teammates can only be invited while the squad is forming");
        }

        Player invitee = resolveInvitee(request);
        if (invitee.getId().equals(captain.getId())) {
            throw ApiException.badRequest("You are already on this squad as the captain");
        }

        TeamInvite invite = teamInviteRepository
                .findByRegistrationIdAndInvitedPlayerId(registration.getId(), invitee.getId())
                .orElse(null);
        if (invite != null && invite.getStatus() != InviteStatus.REJECTED) {
            throw ApiException.conflict(invitee.getGamerTag() + " has already been invited");
        }

        // Invite cap: the captain plus outstanding (accepted + pending) invites must stay under the
        // squad's target size, so a captain can't over-invite past the allowed roster.
        int cap = registration.getTeamSize() != null ? registration.getTeamSize() : DEFAULT_SQUAD_SIZE;
        long committed = 1 + teamInviteRepository
                .findByRegistrationIdOrderByCreatedAtAsc(registration.getId()).stream()
                .filter(t -> t.getStatus() == InviteStatus.ACCEPTED || t.getStatus() == InviteStatus.PENDING)
                .count();
        if (committed >= cap) {
            throw ApiException.conflict("Squad is full — the roster cap is " + cap
                    + ". Wait for a decline before inviting anyone else.");
        }

        if (invite == null) {
            invite = new TeamInvite();
            invite.setRegistration(registration);
            invite.setInvitedPlayer(invitee);
            invite.setInvitedBy(captain);
        }
        invite.setStatus(InviteStatus.PENDING);
        invite.setMessage(request.message());
        teamInviteRepository.save(invite);

        notificationService.create(invitee.getUser(), NotificationType.REGISTRATION,
                "Squad invite",
                captain.getGamerTag() + " invited you to join '" + registration.getSquadName() + "'.",
                "/my/registrations");
        realtimeService.publishToUser(invitee.getUser().getId(), "invite.created",
                Map.of("registrationId", registration.getId().toString(),
                        "squadName", nullSafe(registration.getSquadName())));
        auditService.record("registration.invite", "Registration", registration.getId().toString(),
                captain.getGamerTag() + " invited " + invitee.getGamerTag()
                        + " to '" + registration.getSquadName() + "'");

        return toView(registration);
    }

    /**
     * The invited player accepts or declines a squad invite. Only the invited player may respond, and
     * only while the invite is still pending. Accepting enforces single-team exclusivity for the match:
     * you can't accept once the registration has locked, you can't be confirmed on two teams for the
     * same match, and accepting auto-discards your own forming squad for that match when it has no other
     * confirmed players (but is blocked if you've already built a team with confirmed members). The
     * captain is notified of the response.
     */
    @Transactional
    public InviteView respondToInvite(String inviteId, boolean accept) {
        TeamInvite invite = loadInvite(inviteId);
        Player invitee = invite.getInvitedPlayer();

        if (invitee == null || !invitee.getUser().getId().equals(SecurityUtils.currentUserId())) {
            throw ApiException.forbidden("You can only respond to your own invitations");
        }
        if (invite.getStatus() != InviteStatus.PENDING) {
            throw ApiException.conflict("This invitation has already been answered");
        }

        Registration registration = invite.getRegistration();
        Match match = registration != null ? registration.getMatch() : null;

        if (accept && match != null) {
            // Serialize with the invitee's own applies/accepts — the one-team-per-match guard below is
            // check-then-act (see PlayerRepository.lockById).
            playerRepository.lockById(invitee.getId());
            UUID matchId = match.getId();
            if (matchLocked(match)) {
                throw ApiException.conflict(
                        "Registration for this match has locked — you can no longer join this squad.");
            }
            if (hasAcceptedTeamFor(invitee.getId(), matchId, registration.getId())) {
                throw ApiException.conflict("You're already confirmed on a team for this match.");
            }
            // Accepting supersedes the invitee's own entry for this match: a solo entry is auto-withdrawn,
            // and their own forming squad is auto-discarded — but only if it has no other confirmed
            // players. Otherwise they must discard that team deliberately first.
            for (Registration own : registrationRepository.findByPlayerIdAndMatchId(invitee.getId(), matchId)) {
                if (!isLive(own.getStatus())) {
                    continue;
                }
                if (own.getType() == RegistrationType.SQUAD) {
                    long othersConfirmed = teamInviteRepository
                            .findByRegistrationIdOrderByCreatedAtAsc(own.getId()).stream()
                            .filter(t -> t.getStatus() == InviteStatus.ACCEPTED)
                            .count();
                    if (othersConfirmed > 0) {
                        throw ApiException.conflict("You already have a team with confirmed players for "
                                + "this match — discard it before joining another team.");
                    }
                    voidRegistration(own, RegistrationStatus.WITHDRAWN, "Auto-discarded — you joined another team for this match.");
                } else if (own.getType() == RegistrationType.PLAYER) {
                    voidRegistration(own, RegistrationStatus.WITHDRAWN, "Auto-withdrawn — you joined a team for this match.");
                }
            }
        }

        invite.setStatus(accept ? InviteStatus.ACCEPTED : InviteStatus.REJECTED);
        TeamInvite saved = teamInviteRepository.save(invite);

        Player captain = saved.getInvitedBy();
        if (captain != null && captain.getUser() != null) {
            notificationService.create(captain.getUser(), NotificationType.REGISTRATION,
                    accept ? "Invite accepted" : "Invite declined",
                    invitee.getGamerTag() + (accept ? " joined '" : " declined '")
                            + nullSafe(registration == null ? null : registration.getSquadName()) + "'.",
                    "/my/registrations");
            realtimeService.publishToUser(captain.getUser().getId(),
                    accept ? "invite.accepted" : "invite.rejected",
                    Map.of("inviteId", saved.getId().toString(),
                            "player", nullSafe(invitee.getGamerTag())));
        }
        auditService.record(accept ? "invite.accept" : "invite.reject", "TeamInvite",
                saved.getId().toString(),
                invitee.getGamerTag() + (accept ? " accepted" : " declined") + " a squad invite");

        return toInviteView(saved);
    }

    /**
     * Admin: discard a registration (or a franchise proposal). Marks it REJECTED, voids any still-pending
     * squad invites, notifies the applicant and any confirmed members, and records an audit entry. A
     * reason is optional (a default is used); already-discarded/approved registrations are left alone.
     */
    @Transactional
    public RegistrationView reject(String id, ReviewRequest request) {
        Registration registration = load(id);
        if (registration.getStatus() == RegistrationStatus.REJECTED
                || registration.getStatus() == RegistrationStatus.WITHDRAWN
                || registration.getStatus() == RegistrationStatus.APPROVED) {
            throw ApiException.conflict("This registration has already been finalized");
        }
        String reason = request != null && request.reason() != null && !request.reason().isBlank()
                ? request.reason().trim() : "Discarded by an admin.";

        registration.setReviewedBy(currentReviewer());
        voidRegistration(registration, RegistrationStatus.REJECTED, reason);

        Player player = registration.getPlayer();
        if (player != null && player.getUser() != null) {
            notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                    "Registration discarded",
                    "Your " + describe(registration) + " registration was discarded. Reason: " + reason,
                    "/my/registrations");
            realtimeService.publishToUser(player.getUser().getId(), "registration.rejected",
                    Map.of("registrationId", registration.getId().toString(),
                            "status", "REJECTED", "reason", reason));
        }
        notifyAcceptedMembers(registration, false, reason);
        auditService.record("registration.discard", "Registration", registration.getId().toString(),
                "Discarded " + describe(registration) + ": " + reason);

        return toView(registration);
    }

    /**
     * Player: withdraw your OWN registration (solo entry, forming squad, or auction-pool entry). Only the
     * owner may cancel, and only while it is still open (FORMING/ACTIVE) and — for a match entry — before
     * the lock. This frees the player up to join another team for the same match (the two-pairs regroup).
     * Touches only this Registration row; it can never remove anyone from a franchise ROSTER.
     */
    @Transactional
    public RegistrationView cancelOwnRegistration(String id) {
        Player player = currentPlayer();
        Registration registration = load(id);
        if (registration.getPlayer() == null || !registration.getPlayer().getId().equals(player.getId())) {
            throw ApiException.forbidden("You can only cancel your own registration");
        }
        if (registration.getStatus() != RegistrationStatus.FORMING
                && registration.getStatus() != RegistrationStatus.ACTIVE) {
            throw ApiException.conflict("This registration can no longer be withdrawn");
        }
        if (registration.getMatch() != null && matchLocked(registration.getMatch())) {
            throw ApiException.conflict("Registration has locked for this match — it can't be withdrawn now");
        }
        voidRegistration(registration, RegistrationStatus.WITHDRAWN, "Withdrawn by the player.");
        // A forming squad's accepted members lose their team — tell them.
        notifyAcceptedMembers(registration, false, "The captain withdrew the squad.");
        auditService.record("registration.cancel", "Registration", registration.getId().toString(),
                player.getGamerTag() + " withdrew " + describe(registration));
        return toView(registration);
    }

    /**
     * Player: remove one of their own <em>settled</em> registrations from their My-Team history (a soft
     * hide, not a hard delete). Only allowed for terminal states — a live FORMING/ACTIVE/PENDING entry
     * must be withdrawn first, not hidden.
     */
    @Transactional
    public void hideOwnRegistration(String id) {
        Player player = currentPlayer();
        Registration registration = load(id);
        if (registration.getPlayer() == null || !registration.getPlayer().getId().equals(player.getId())) {
            throw ApiException.forbidden("You can only remove your own registrations");
        }
        RegistrationStatus s = registration.getStatus();
        if (s == RegistrationStatus.FORMING || s == RegistrationStatus.ACTIVE
                || s == RegistrationStatus.PENDING) {
            throw ApiException.conflict("Withdraw this registration before removing it from your history.");
        }
        registration.setHidden(true);
        registrationRepository.save(registration);
    }

    /**
     * Player: leave a FORMING squad you've accepted an invite for (e.g. to accept a different squad's
     * invite instead). Only the invited player may leave, and only while the squad is still forming.
     * Sets the invite back to REJECTED so the captain sees the seat open again. Roster membership on a
     * franchise is unaffected — this only touches the squad-invite row.
     */
    @Transactional
    public InviteView leaveSquad(String inviteId) {
        TeamInvite invite = loadInvite(inviteId);
        Player invitee = invite.getInvitedPlayer();
        if (invitee == null || invitee.getUser() == null
                || !invitee.getUser().getId().equals(SecurityUtils.currentUserId())) {
            throw ApiException.forbidden("You can only leave a squad you joined");
        }
        Registration registration = invite.getRegistration();
        if (invite.getStatus() != InviteStatus.ACCEPTED
                || registration == null || registration.getStatus() != RegistrationStatus.FORMING) {
            throw ApiException.conflict("You can only leave a squad that is still forming");
        }
        invite.setStatus(InviteStatus.REJECTED);
        TeamInvite saved = teamInviteRepository.save(invite);
        Player captain = registration.getPlayer();
        if (captain != null && captain.getUser() != null) {
            notificationService.create(captain.getUser(), NotificationType.REGISTRATION,
                    "A player left the squad",
                    invitee.getGamerTag() + " left '" + nullSafe(registration.getSquadName()) + "'.",
                    "/my/registrations");
        }
        auditService.record("invite.leave", "TeamInvite", saved.getId().toString(),
                invitee.getGamerTag() + " left a squad");
        return toInviteView(saved);
    }

    // ---- helpers ----

    /** Notify every accepted squad member (not just the captain) when a squad is approved/rejected. */
    private void notifyAcceptedMembers(Registration registration, boolean approved, String reason) {
        if (registration.getType() != RegistrationType.SQUAD) {
            return;
        }
        String title = approved ? "Squad approved" : "Squad rejected";
        for (TeamInvite invite : teamInviteRepository.findByRegistrationIdOrderByCreatedAtAsc(registration.getId())) {
            if (invite.getStatus() != InviteStatus.ACCEPTED) {
                continue;
            }
            Player member = invite.getInvitedPlayer();
            if (member == null || member.getUser() == null) {
                continue;
            }
            String body = approved
                    ? "The " + describe(registration) + " squad you joined was approved."
                    : "The " + describe(registration) + " squad you joined was rejected."
                            + (reason != null && !reason.isBlank() ? " Reason: " + reason : "");
            notificationService.create(member.getUser(), NotificationType.REGISTRATION, title, body,
                    "/my/registrations");
            realtimeService.publishToUser(member.getUser().getId(),
                    approved ? "registration.approved" : "registration.rejected",
                    Map.of("registrationId", registration.getId().toString(),
                            "status", approved ? "APPROVED" : "REJECTED"));
        }
    }

    private Player currentPlayer() {
        return playerRepository.findByUserId(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.badRequest("No player profile for current user"));
    }

    private Player resolveInvitee(InviteRequest request) {
        if (request.playerId() != null && !request.playerId().isBlank()) {
            UUID pid;
            try {
                pid = UUID.fromString(request.playerId());
            } catch (IllegalArgumentException ex) {
                throw ApiException.notFound("Player", request.playerId());
            }
            return playerRepository.findById(pid)
                    .orElseThrow(() -> ApiException.notFound("Player", request.playerId()));
        }
        if (request.gamerTag() != null && !request.gamerTag().isBlank()) {
            return playerRepository.findByGamerTagIgnoreCase(request.gamerTag().trim())
                    .orElseThrow(() -> ApiException.notFound("Player", request.gamerTag()));
        }
        throw ApiException.badRequest("Provide a gamerTag or playerId to invite");
    }

    private Registration load(String id) {
        UUID uuid = parseId(id, "Registration");
        return registrationRepository.findById(uuid)
                .orElseThrow(() -> ApiException.notFound("Registration", id));
    }

    private TeamInvite loadInvite(String id) {
        UUID uuid = parseId(id, "TeamInvite");
        return teamInviteRepository.findById(uuid)
                .orElseThrow(() -> ApiException.notFound("TeamInvite", id));
    }

    /** Whether a status still counts as a live entry for a match (not discarded / not a proposal). */
    private static boolean isLive(RegistrationStatus s) {
        return s == RegistrationStatus.FORMING
                || s == RegistrationStatus.ACTIVE
                || s == RegistrationStatus.LOCKED;
    }

    /** The configured registration-lock window in hours (falls back to 3 if settings are missing). */
    int lockHours() {
        LeagueSettings s = leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID).orElse(null);
        return s != null ? Math.max(0, s.getRegistrationLockHours()) : 3;
    }

    /** Whether a match's registration window has closed (within the lock window of the scheduled start). */
    private boolean matchLocked(Match match) {
        return match.getScheduledAt() != null
                && Instant.now().isAfter(match.getScheduledAt().minus(Duration.ofHours(lockHours())));
    }

    /**
     * Whether the player is already an ACCEPTED member of some team for this match, optionally excluding
     * one registration (so a captain checking from within their own squad isn't counted against itself).
     */
    private boolean hasAcceptedTeamFor(UUID playerId, UUID matchId, UUID excludeRegistrationId) {
        return teamInviteRepository.findByInvitedPlayerIdOrderByCreatedAtDesc(playerId).stream()
                .filter(t -> t.getStatus() == InviteStatus.ACCEPTED)
                .map(TeamInvite::getRegistration)
                .filter(r -> r != null && r.getMatch() != null && matchId.equals(r.getMatch().getId()))
                .anyMatch(r -> excludeRegistrationId == null || !excludeRegistrationId.equals(r.getId()));
    }

    /** Void a registration: mark it REJECTED and expire any still-pending invites so they can't be accepted. */
    /**
     * Void a registration to a terminal state: REJECTED for an admin's punitive discard, WITHDRAWN for a
     * neutral player/closure void. Either way its still-pending invites are expired. {@code isLive} counts
     * only FORMING/ACTIVE/LOCKED, so both terminal states drop it out of every exclusivity guard.
     */
    private void voidRegistration(Registration reg, RegistrationStatus targetStatus, String reason) {
        reg.setStatus(targetStatus);
        reg.setReason(reason);
        registrationRepository.save(reg);
        for (TeamInvite t : teamInviteRepository.findByRegistrationIdOrderByCreatedAtAsc(reg.getId())) {
            if (t.getStatus() == InviteStatus.PENDING) {
                t.setStatus(InviteStatus.EXPIRED);
                teamInviteRepository.save(t);
            }
        }
    }

    /**
     * Lock a match's registrations at the deadline: FORMING/ACTIVE squads and solo entries become
     * LOCKED (roster frozen) and their still-pending invites are voided. Called by the lock sweep.
     * Returns the number of registrations locked.
     */
    @Transactional
    public int lockMatchRegistrations(UUID matchId) {
        int locked = 0;
        for (Registration reg : registrationRepository.findByMatchId(matchId)) {
            if (reg.getStatus() == RegistrationStatus.FORMING
                    || reg.getStatus() == RegistrationStatus.ACTIVE) {
                reg.setStatus(RegistrationStatus.LOCKED);
                registrationRepository.save(reg);
                int expired = 0;
                for (TeamInvite t : teamInviteRepository.findByRegistrationIdOrderByCreatedAtAsc(reg.getId())) {
                    if (t.getStatus() == InviteStatus.PENDING) {
                        t.setStatus(InviteStatus.EXPIRED);
                        teamInviteRepository.save(t);
                        expired++;
                    }
                }
                // The UI warns that pending invites are voided at lock time — tell the captain when it
                // actually happens, so a half-formed squad isn't a match-day surprise.
                Player applicant = reg.getPlayer();
                if (applicant != null && applicant.getUser() != null) {
                    String detail = reg.getType() == RegistrationType.SQUAD
                            ? "'" + nullSafe(reg.getSquadName()) + "' is locked for the match"
                                    + (expired > 0 ? " — " + expired + " pending invite(s) expired." : ".")
                            : "Your entry is locked in for the match.";
                    notificationService.create(applicant.getUser(), NotificationType.REGISTRATION,
                            "Roster locked", detail, "/my/registrations");
                }
                locked++;
            }
        }
        return locked;
    }

    /**
     * Void the still-open (never-locked) registrations tied to a match — used when its registration call
     * is closed. LOCKED entries are left intact (they're the frozen roster of a played fixture).
     */
    @Transactional
    public void voidOpenForMatch(UUID matchId, String reason) {
        for (Registration reg : registrationRepository.findByMatchId(matchId)) {
            if (reg.getStatus() == RegistrationStatus.FORMING
                    || reg.getStatus() == RegistrationStatus.ACTIVE) {
                voidRegistration(reg, RegistrationStatus.WITHDRAWN, reason);
                // Don't kill a registration silently — the applicant (and any accepted squad members) are told.
                Player applicant = reg.getPlayer();
                if (applicant != null && applicant.getUser() != null) {
                    notificationService.create(applicant.getUser(), NotificationType.REGISTRATION,
                            "Registration closed",
                            "Your " + describe(reg) + " registration was closed: " + reason,
                            "/my/registrations");
                }
                notifyAcceptedMembers(reg, false, reason);
            }
        }
    }

    /** Void every still-PENDING franchise proposal — used when a season starts / a franchise call closes. */
    @Transactional
    public void voidPendingFranchiseProposals(String reason) {
        for (Registration reg : registrationRepository
                .findByStatusAndTypeOrderByCreatedAtDesc(RegistrationStatus.PENDING, RegistrationType.FRANCHISE)) {
            voidRegistration(reg, RegistrationStatus.WITHDRAWN, reason);
            Player player = reg.getPlayer();
            if (player != null && player.getUser() != null) {
                notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                        "Franchise call closed",
                        "Your " + describe(reg) + " proposal was closed: " + reason,
                        "/my/registrations");
            }
        }
    }

    private User currentReviewer() {
        UUID userId = SecurityUtils.currentUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Authentication required"));
    }

    private static String describe(Registration registration) {
        if (registration.getType() == RegistrationType.SQUAD) {
            return "squad '" + nullSafe(registration.getSquadName()) + "'";
        }
        if (registration.getType() == RegistrationType.FRANCHISE) {
            return "franchise '" + nullSafe(registration.getSquadName()) + "'";
        }
        Player player = registration.getPlayer();
        if (registration.getType() == RegistrationType.AUCTION) {
            return player != null ? player.getGamerTag() + "'s auction entry" : "auction entry";
        }
        return player != null ? player.getGamerTag() + "'s solo" : "solo";
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    /** Normalize a requested franchise tag: uppercase, strip non-alphanumerics, cap at 16; null when blank. */
    private static String normalizeTag(String raw) {
        if (raw == null) {
            return null;
        }
        String cleaned = raw.trim().toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (cleaned.isEmpty()) {
            return null;
        }
        return cleaned.length() > 16 ? cleaned.substring(0, 16) : cleaned;
    }

    private static UUID parseId(String id, String resource) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound(resource, id);
        }
    }

    private RegistrationView toView(Registration registration) {
        Player player = registration.getPlayer();
        RegistrationView.PlayerMini playerMini = player == null ? null
                : new RegistrationView.PlayerMini(
                        player.getId().toString(),
                        player.getGamerTag());

        User reviewer = registration.getReviewedBy();
        String reviewedBy = reviewer == null ? null : reviewer.getName();

        // Squad roster: the captain (always confirmed) plus invited players with their invite status.
        List<RegistrationView.MemberView> members = new ArrayList<>();
        int acceptedCount = 0;
        if (registration.getType() == RegistrationType.SQUAD && player != null) {
            members.add(new RegistrationView.MemberView(
                    player.getId().toString(), player.getGamerTag(), "ACCEPTED", true));
            acceptedCount = 1;
            for (TeamInvite invite : teamInviteRepository
                    .findByRegistrationIdOrderByCreatedAtAsc(registration.getId())) {
                Player invitee = invite.getInvitedPlayer();
                members.add(new RegistrationView.MemberView(
                        invitee == null ? null : invitee.getId().toString(),
                        invitee == null ? null : invitee.getGamerTag(),
                        invite.getStatus().name(),
                        false));
                if (invite.getStatus() == InviteStatus.ACCEPTED) {
                    acceptedCount++;
                }
            }
        } else if (player != null) {
            acceptedCount = 1;
        }

        String matchId = registration.getMatch() != null
                ? registration.getMatch().getId().toString() : null;
        String matchSlug = registration.getMatch() != null
                ? registration.getMatch().getSlug() : null;

        Game game = registration.getGame();
        String gameId = game != null ? game.getId().toString() : null;
        String gameName = game != null ? game.getName() : null;

        return new RegistrationView(
                registration.getId().toString(),
                registration.getType().name(),
                playerMini,
                registration.getSquadName(),
                registration.getFranchiseTag(),
                List.copyOf(registration.getGames()),
                registration.getContact(),
                registration.getStatus().name(),
                reviewedBy,
                registration.getReason(),
                registration.getCreatedAt(),
                matchId,
                matchSlug,
                gameId,
                gameName,
                members,
                acceptedCount,
                registration.getTeamSize(),
                registration.isConsumed());
    }

    /**
     * Build the invite view including the squad's current roster (captain + invitees with their status)
     * so the invited player can see who's already confirmed before deciding.
     */
    private InviteView toInviteView(TeamInvite invite) {
        Registration registration = invite.getRegistration();
        Player captain = invite.getInvitedBy();

        List<InviteView.MemberView> members = new ArrayList<>();
        if (registration != null) {
            Player regCaptain = registration.getPlayer();
            if (regCaptain != null) {
                members.add(new InviteView.MemberView(regCaptain.getGamerTag(), "ACCEPTED", true));
            }
            for (TeamInvite t : teamInviteRepository
                    .findByRegistrationIdOrderByCreatedAtAsc(registration.getId())) {
                Player p = t.getInvitedPlayer();
                members.add(new InviteView.MemberView(
                        p == null ? null : p.getGamerTag(), t.getStatus().name(), false));
            }
        }

        return new InviteView(
                invite.getId().toString(),
                registration == null ? null : registration.getId().toString(),
                registration == null ? null : registration.getSquadName(),
                captain == null ? null : captain.getGamerTag(),
                registration == null ? List.of() : List.copyOf(registration.getGames()),
                invite.getStatus().name(),
                registration == null ? null : registration.getStatus().name(),
                invite.getMessage(),
                invite.getCreatedAt(),
                members);
    }
}
