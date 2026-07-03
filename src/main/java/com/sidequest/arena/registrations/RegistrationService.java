package com.sidequest.arena.registrations;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.InviteStatus;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.TeamInvite;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.realtime.RealtimeService;
import com.sidequest.arena.registrations.dto.ApplyRequest;
import com.sidequest.arena.registrations.dto.InviteRequest;
import com.sidequest.arena.registrations.dto.InviteView;
import com.sidequest.arena.registrations.dto.RegistrationView;
import com.sidequest.arena.registrations.dto.ReviewRequest;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
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

    private final RegistrationRepository registrationRepository;
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;
    private final TeamInviteRepository teamInviteRepository;
    private final MatchRepository matchRepository;
    private final GameRepository gameRepository;
    private final RealtimeService realtimeService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public RegistrationService(RegistrationRepository registrationRepository,
                               PlayerRepository playerRepository,
                               UserRepository userRepository,
                               TeamInviteRepository teamInviteRepository,
                               MatchRepository matchRepository,
                               GameRepository gameRepository,
                               RealtimeService realtimeService,
                               NotificationService notificationService,
                               AuditService auditService) {
        this.registrationRepository = registrationRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.teamInviteRepository = teamInviteRepository;
        this.matchRepository = matchRepository;
        this.gameRepository = gameRepository;
        this.realtimeService = realtimeService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    /**
     * Apply to the league as a player or squad on behalf of the current user. SQUAD applications
     * require a non-blank squad name. The new registration starts PENDING. Notifies the applicant
     * (confirmation) and every admin (a new application to review).
     */
    @Transactional
    public RegistrationView apply(ApplyRequest request) {
        if (request.type() != RegistrationType.PLAYER
                && (request.squadName() == null || request.squadName().isBlank())) {
            throw ApiException.badRequest(
                    request.type() == RegistrationType.FRANCHISE
                            ? "a franchise name is required for franchise registrations"
                            : "squadName is required for squad registrations");
        }

        Player player = currentPlayer();

        Registration registration = new Registration();
        registration.setType(request.type());
        registration.setPlayer(player);
        registration.setSquadName(request.squadName());
        registration.setGames(new ArrayList<>(request.games()));
        registration.setContact(request.contact());
        registration.setStatus(RegistrationStatus.PENDING);

        Game game = null;
        if (request.matchId() != null && !request.matchId().isBlank()) {
            Match match = matchRepository.findById(parseId(request.matchId(), "Match"))
                    .orElseThrow(() -> ApiException.notFound("Match", request.matchId()));

            // Prevent duplicate entries: a player may only have one live (non-rejected) registration per match.
            boolean alreadyEntered = registrationRepository
                    .findByPlayerIdAndMatchId(player.getId(), match.getId()).stream()
                    .anyMatch(r -> r.getStatus() != RegistrationStatus.REJECTED);
            if (alreadyEntered) {
                throw ApiException.conflict("You have already registered for this match");
            }

            // Registration locks 3 hours before the scheduled start.
            if (match.getScheduledAt() != null
                    && Instant.now().isAfter(match.getScheduledAt().minus(Duration.ofHours(3)))) {
                throw ApiException.badRequest(
                        "Registration is closed — it locks 3 hours before match time");
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

        Registration saved = registrationRepository.save(registration);

        String what = describe(saved);

        // Confirmation to the applicant.
        notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                "Registration received",
                "Your " + what + " registration is pending review.", "/my/registrations");

        // Fan out to admins so they pick it up in the approval queue.
        for (User admin : userRepository.findByRole(Role.ADMIN)) {
            notificationService.create(admin, NotificationType.REGISTRATION,
                    "New registration",
                    player.getGamerTag() + " registered (" + what + ").", "/admin/registrations");
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
                .map(RegistrationService::toInviteView)
                .toList();
    }

    /**
     * Captain invites a teammate to their SQUAD registration. The invitee is resolved by gamer tag or
     * player id. Re-inviting a player who previously declined re-opens their invite. Only the captain of
     * a still-pending squad may invite. The invited player is notified.
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
        if (registration.getStatus() != RegistrationStatus.PENDING) {
            throw ApiException.conflict("This registration has already been reviewed");
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
     * only while the invite is still pending. The captain is notified of the response.
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

        invite.setStatus(accept ? InviteStatus.ACCEPTED : InviteStatus.REJECTED);
        TeamInvite saved = teamInviteRepository.save(invite);

        Registration registration = saved.getRegistration();
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
     * Approve a registration: mark APPROVED, attribute the reviewer, verify the applicant player
     * (if any), notify the applicant, push a realtime event and record an audit entry. Already-reviewed
     * registrations conflict.
     */
    @Transactional
    public RegistrationView approve(String id, ReviewRequest request) {
        Registration registration = load(id);
        ensurePending(registration);

        registration.setStatus(RegistrationStatus.APPROVED);
        registration.setReviewedBy(currentReviewer());
        registration.setReason(request == null ? null : request.note());

        Player player = registration.getPlayer();
        if (player != null) {
            player.setStatus(PlayerStatus.VERIFIED);
            playerRepository.save(player);
        }

        Registration saved = registrationRepository.save(registration);

        if (player != null) {
            notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                    "Registration approved",
                    "Your " + describe(saved) + " registration was approved.", "/my/registrations");
            realtimeService.publishToUser(player.getUser().getId(), "registration.approved",
                    Map.of("registrationId", saved.getId().toString(), "status", "APPROVED"));
        }
        notifyAcceptedMembers(saved, true, null);
        auditService.record("registration.approve", "Registration", saved.getId().toString(),
                "Approved " + describe(saved));

        return toView(saved);
    }

    /**
     * Reject a registration: mark REJECTED with a required non-blank reason, attribute the
     * reviewer, notify the applicant, push a realtime event and record an audit entry. Already-reviewed
     * registrations conflict.
     */
    @Transactional
    public RegistrationView reject(String id, ReviewRequest request) {
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw ApiException.badRequest("reason is required to reject a registration");
        }

        Registration registration = load(id);
        ensurePending(registration);

        registration.setStatus(RegistrationStatus.REJECTED);
        registration.setReviewedBy(currentReviewer());
        registration.setReason(request.reason());

        Registration saved = registrationRepository.save(registration);

        Player player = saved.getPlayer();
        if (player != null) {
            notificationService.create(player.getUser(), NotificationType.REGISTRATION,
                    "Registration rejected",
                    "Your " + describe(saved) + " registration was rejected. Reason: " + request.reason(),
                    "/my/registrations");
            realtimeService.publishToUser(player.getUser().getId(), "registration.rejected",
                    Map.of("registrationId", saved.getId().toString(),
                            "status", "REJECTED",
                            "reason", request.reason()));
        }
        notifyAcceptedMembers(saved, false, request.reason());
        auditService.record("registration.reject", "Registration", saved.getId().toString(),
                "Rejected " + describe(saved) + ": " + request.reason());

        return toView(saved);
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

    private static void ensurePending(Registration registration) {
        if (registration.getStatus() == RegistrationStatus.APPROVED
                || registration.getStatus() == RegistrationStatus.REJECTED) {
            throw ApiException.conflict("Registration already reviewed");
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
        return player != null ? player.getGamerTag() + "'s solo" : "solo";
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
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

        Game game = registration.getGame();
        String gameId = game != null ? game.getId().toString() : null;
        String gameName = game != null ? game.getName() : null;

        return new RegistrationView(
                registration.getId().toString(),
                registration.getType().name(),
                playerMini,
                registration.getSquadName(),
                List.copyOf(registration.getGames()),
                registration.getContact(),
                registration.getStatus().name(),
                reviewedBy,
                registration.getReason(),
                registration.getCreatedAt(),
                matchId,
                gameId,
                gameName,
                members,
                acceptedCount);
    }

    private static InviteView toInviteView(TeamInvite invite) {
        Registration registration = invite.getRegistration();
        Player captain = invite.getInvitedBy();
        return new InviteView(
                invite.getId().toString(),
                registration == null ? null : registration.getId().toString(),
                registration == null ? null : registration.getSquadName(),
                captain == null ? null : captain.getGamerTag(),
                registration == null ? List.of() : List.copyOf(registration.getGames()),
                invite.getStatus().name(),
                invite.getMessage(),
                invite.getCreatedAt());
    }
}
