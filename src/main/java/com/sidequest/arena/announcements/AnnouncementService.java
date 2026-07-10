package com.sidequest.arena.announcements;

import com.sidequest.arena.announcements.dto.AnnouncementView;
import com.sidequest.arena.announcements.dto.CreateAnnouncementRequest;
import com.sidequest.arena.announcements.dto.UpdateAnnouncementRequest;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AnnouncementCategory;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.model.User;
import com.sidequest.arena.registrations.RegistrationService;
import com.sidequest.arena.repo.AnnouncementRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.SeasonRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read/admin operations over the league announcement feed: the (optionally category-filtered)
 * paginated feed, single-post fetch, and admin create/update/delete with audit logging. Mappers
 * convert entities to {@link AnnouncementView} so entities are never returned directly.
 */
@Service
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;
    private final GameRepository gameRepository;
    private final MatchRepository matchRepository;
    private final SeasonRepository seasonRepository;
    private final RegistrationService registrationService;
    private final AuditService auditService;

    public AnnouncementService(AnnouncementRepository announcementRepository,
                               UserRepository userRepository,
                               GameRepository gameRepository,
                               MatchRepository matchRepository,
                               SeasonRepository seasonRepository,
                               RegistrationService registrationService,
                               AuditService auditService) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
        this.gameRepository = gameRepository;
        this.matchRepository = matchRepository;
        this.seasonRepository = seasonRepository;
        this.registrationService = registrationService;
        this.auditService = auditService;
    }

    /**
     * The announcement feed, newest first, optionally restricted to a single {@code category},
     * then cursor-paginated.
     */
    @Transactional(readOnly = true)
    public PageResponse<AnnouncementView> list(AnnouncementCategory category, Integer limit, String cursor) {
        List<Announcement> announcements = category != null
                ? announcementRepository.findByCategoryOrderByPublishedAtDesc(category)
                : announcementRepository.findAllByOrderByPublishedAtDesc();

        List<AnnouncementView> views = announcements.stream()
                .map(AnnouncementService::toView)
                .toList();
        return Cursors.paginate(views, cursor, limit);
    }

    /** A single announcement. 404 if it does not exist (an unparseable id can never match). */
    @Transactional(readOnly = true)
    public AnnouncementView get(String id) {
        return toView(require(id));
    }

    /**
     * Create an announcement. The optional {@code matchId} is accepted but intentionally not linked
     * (no cross-domain match lookup); {@code publishedAt} defaults to now; the author is the current
     * user. Records an audit entry and returns the created view.
     */
    @Transactional
    public AnnouncementView create(CreateAnnouncementRequest req) {
        Announcement announcement = new Announcement();
        announcement.setCategory(req.category());
        announcement.setTitle(req.title());
        announcement.setBody(req.body());
        // Link the match when one is supplied (e.g. a registration call tied to a scheduled fixture).
        // A RESULT announcement MUST link its match so the public feed can deep-link to that match's
        // result page; other categories link a match optionally.
        Match linkedMatch = null;
        if (req.matchId() != null && !req.matchId().isBlank()) {
            try {
                linkedMatch = matchRepository.findById(UUID.fromString(req.matchId())).orElse(null);
            } catch (IllegalArgumentException ignored) {
                linkedMatch = null;
            }
        }
        if (req.category() == AnnouncementCategory.RESULT && linkedMatch == null) {
            throw ApiException.badRequest(
                    "A result announcement must link the match it reports");
        }
        // Franchise-creation calls belong to the off-season — a season must be finished before a new
        // franchise call opens. Keyed on the FRANCHISE registration mode (the franchise template uses
        // category GENERAL), and only when it actually opens sign-ups.
        if (req.registrationOpen() && req.registrationType() == RegistrationType.FRANCHISE && seasonActive()) {
            throw ApiException.badRequest(
                    "Franchise registration calls can only be opened between seasons — finish the current season first");
        }
        announcement.setMatch(linkedMatch);
        announcement.setPublishedAt(req.publishedAt() != null ? req.publishedAt() : Instant.now());
        announcement.setRegistrationOpen(req.registrationOpen());
        announcement.setRegistrationType(
                req.registrationType() != null ? req.registrationType() : RegistrationType.PLAYER);
        announcement.setTeamSize(req.teamSize());
        if (req.gameId() != null && !req.gameId().isBlank()) {
            try {
                gameRepository.findById(UUID.fromString(req.gameId())).ifPresent(announcement::setGame);
            } catch (IllegalArgumentException ignored) {
                // unparseable game id → leave game unlinked
            }
        }

        User author = userRepository.findById(SecurityUtils.currentUserId()).orElse(null);
        announcement.setAuthor(author);

        Announcement saved = announcementRepository.save(announcement);
        auditService.record("announcement.create", "Announcement", saved.getId().toString(), saved.getTitle());
        return toView(saved);
    }

    /** Apply the non-null fields of the update, persist, audit, and return the refreshed view. */
    @Transactional
    public AnnouncementView update(String id, UpdateAnnouncementRequest req) {
        Announcement announcement = require(id);

        if (req.category() != null) {
            announcement.setCategory(req.category());
        }
        if (req.title() != null) {
            announcement.setTitle(req.title());
        }
        if (req.body() != null) {
            announcement.setBody(req.body());
        }

        Announcement saved = announcementRepository.save(announcement);
        auditService.record("announcement.update", "Announcement", saved.getId().toString(), saved.getTitle());
        return toView(saved);
    }

    /** Delete an announcement (404 if missing) and record an audit entry. */
    @Transactional
    public void delete(String id) {
        Announcement announcement = require(id);
        // Deleting an OPEN registration call must not strand its live sign-ups — run the same voiding
        // path close() uses, so applicants are told instead of holding registrations for a call that no
        // longer exists.
        if (announcement.isRegistrationOpen()) {
            close(id);
        }
        announcementRepository.delete(announcement);
        auditService.record("announcement.delete", "Announcement", announcement.getId().toString(),
                announcement.getTitle());
    }

    /**
     * Admin: close a registration call — stop new sign-ups (the Register button disappears everywhere it
     * keys on registrationOpen) and void the still-open sign-ups it was collecting. For a match-tied call
     * the match's open (never-locked) entries are voided; for a franchise call, still-PENDING proposals.
     */
    @Transactional
    public AnnouncementView close(String id) {
        Announcement a = require(id);
        if (a.isRegistrationOpen()) {
            a.setRegistrationOpen(false);
            announcementRepository.save(a);
            auditService.record("announcement.close", "Announcement", a.getId().toString(), a.getTitle());
        }
        if (a.getMatch() != null) {
            registrationService.voidOpenForMatch(a.getMatch().getId(), "Registration closed by an admin.");
        } else if (a.getRegistrationType() == RegistrationType.FRANCHISE) {
            registrationService.voidPendingFranchiseProposals("Franchise call closed by an admin.");
        }
        return toView(a);
    }

    /**
     * Close every open registration call linked to a match (its window passed or it finished/cancelled)
     * so late sign-ups can't arrive. Leaves the frozen roster registrations untouched. No-op when none.
     */
    @Transactional
    public void closeForMatch(UUID matchId) {
        for (Announcement a : announcementRepository.findByMatchIdAndRegistrationOpenTrue(matchId)) {
            a.setRegistrationOpen(false);
            announcementRepository.save(a);
            auditService.record("announcement.close", "Announcement", a.getId().toString(),
                    "auto-closed (match finished)");
        }
    }

    /**
     * Auction pool locked: close every open AUCTION registration call so the Register button disappears
     * everywhere and the call reads closed — the same effect an admin closing it by hand would have.
     * Pool registrations themselves stay ACTIVE (never voided): the locked pool still feeds the lots and
     * they are only consumed when the auction completes. No-op when none are open.
     */
    @Transactional
    public void closeAuctionCalls() {
        for (Announcement a : announcementRepository
                .findByRegistrationOpenTrueAndRegistrationType(RegistrationType.AUCTION)) {
            a.setRegistrationOpen(false);
            announcementRepository.save(a);
            auditService.record("announcement.close", "Announcement", a.getId().toString(),
                    "auto-closed (auction pool locked)");
        }
    }

    /** Season start: close every open franchise call and void still-pending franchise proposals. */
    @Transactional
    public void closeFranchiseCalls() {
        for (Announcement a : announcementRepository
                .findByRegistrationOpenTrueAndRegistrationType(RegistrationType.FRANCHISE)) {
            a.setRegistrationOpen(false);
            announcementRepository.save(a);
            auditService.record("announcement.close", "Announcement", a.getId().toString(),
                    "auto-closed (season started)");
        }
        registrationService.voidPendingFranchiseProposals("A season started — franchise calls are closed.");
    }

    // ---- helpers ----

    /** Whether a season is currently ACTIVE — franchise calls are off-season only. */
    private boolean seasonActive() {
        return seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE).isPresent();
    }

    /** Load an announcement by its string id, or throw 404 (an unparseable id can never match). */
    private Announcement require(String id) {
        return announcementRepository.findById(parseId(id))
                .orElseThrow(() -> ApiException.notFound("Announcement", id));
    }

    private static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Announcement", id);
        }
    }

    private static AnnouncementView toView(Announcement a) {
        String matchId = a.getMatch() != null ? a.getMatch().getId().toString() : null;
        String author = a.getAuthor() != null ? a.getAuthor().getName() : null;
        String gameId = a.getGame() != null ? a.getGame().getId().toString() : null;
        String gameName = a.getGame() != null ? a.getGame().getName() : null;
        return new AnnouncementView(
                a.getId().toString(),
                a.getCategory() != null ? a.getCategory().name() : null,
                a.getTitle(),
                a.getBody(),
                matchId,
                author,
                a.getPublishedAt(),
                a.isRegistrationOpen(),
                gameId,
                gameName,
                a.getRegistrationType() != null ? a.getRegistrationType().name() : null,
                a.getTeamSize());
    }
}
