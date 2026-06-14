package com.sidequest.arena.registrations;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.User;
import com.sidequest.arena.realtime.RealtimeService;
import com.sidequest.arena.registrations.dto.ApplyRequest;
import com.sidequest.arena.registrations.dto.RegistrationView;
import com.sidequest.arena.registrations.dto.ReviewRequest;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * League registration / approval-queue logic: applying as a player or squad, the admin approval
 * queue with filtering, registration detail, and approve / reject review actions (with realtime
 * pushes and audit entries).
 */
@Service
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;
    private final RealtimeService realtimeService;
    private final AuditService auditService;

    public RegistrationService(RegistrationRepository registrationRepository,
                               PlayerRepository playerRepository,
                               UserRepository userRepository,
                               RealtimeService realtimeService,
                               AuditService auditService) {
        this.registrationRepository = registrationRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.realtimeService = realtimeService;
        this.auditService = auditService;
    }

    /**
     * Apply to the league as a player or squad on behalf of the current user. SQUAD applications
     * require a non-blank squad name. The new registration starts PENDING.
     */
    @Transactional
    public RegistrationView apply(ApplyRequest request) {
        if (request.type() == RegistrationType.SQUAD
                && (request.squadName() == null || request.squadName().isBlank())) {
            throw ApiException.badRequest("squadName is required for squad registrations");
        }

        Player player = playerRepository.findByUserId(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.badRequest("No player profile for current user"));

        Registration registration = new Registration();
        registration.setType(request.type());
        registration.setPlayer(player);
        registration.setSquadName(request.squadName());
        registration.setGames(new ArrayList<>(request.games()));
        registration.setContact(request.contact());
        registration.setStatus(RegistrationStatus.PENDING);

        Registration saved = registrationRepository.save(registration);
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
                .map(RegistrationService::toView)
                .toList();

        return Cursors.paginate(views, cursor, limit);
    }

    /** Full detail for a single registration (admin). */
    @Transactional(readOnly = true)
    public RegistrationView get(String id) {
        return toView(load(id));
    }

    /**
     * Approve a registration: mark APPROVED, attribute the reviewer, verify the applicant player
     * (if any), push a realtime event and record an audit entry. Already-reviewed registrations
     * conflict.
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
            realtimeService.publishToUser(player.getUser().getId(), "registration.approved",
                    Map.of("registrationId", saved.getId().toString(), "status", "APPROVED"));
        }
        auditService.record("registration.approve", "Registration", saved.getId().toString(), null);

        return toView(saved);
    }

    /**
     * Reject a registration: mark REJECTED with a required non-blank reason, attribute the
     * reviewer, push a realtime event and record an audit entry. Already-reviewed registrations
     * conflict.
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
            realtimeService.publishToUser(player.getUser().getId(), "registration.rejected",
                    Map.of("registrationId", saved.getId().toString(),
                            "status", "REJECTED",
                            "reason", request.reason()));
        }
        auditService.record("registration.reject", "Registration", saved.getId().toString(), null);

        return toView(saved);
    }

    // ---- helpers ----

    private Registration load(String id) {
        UUID uuid = parseId(id);
        return registrationRepository.findById(uuid)
                .orElseThrow(() -> ApiException.notFound("Registration", id));
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

    private static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Registration", id);
        }
    }

    private static RegistrationView toView(Registration registration) {
        Player player = registration.getPlayer();
        RegistrationView.PlayerMini playerMini = player == null ? null
                : new RegistrationView.PlayerMini(
                        player.getId().toString(),
                        player.getGamerTag());

        User reviewer = registration.getReviewedBy();
        String reviewedBy = reviewer == null ? null : reviewer.getName();

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
                registration.getCreatedAt());
    }
}
