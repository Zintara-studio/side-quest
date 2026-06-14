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
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.AnnouncementRepository;
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
    private final AuditService auditService;

    public AnnouncementService(AnnouncementRepository announcementRepository,
                               UserRepository userRepository,
                               AuditService auditService) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
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
        // matchId is accepted but not linked to avoid cross-domain coupling; leave match null.
        announcement.setPublishedAt(req.publishedAt() != null ? req.publishedAt() : Instant.now());

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
        announcementRepository.delete(announcement);
        auditService.record("announcement.delete", "Announcement", announcement.getId().toString(),
                announcement.getTitle());
    }

    // ---- helpers ----

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
        return new AnnouncementView(
                a.getId().toString(),
                a.getCategory() != null ? a.getCategory().name() : null,
                a.getTitle(),
                a.getBody(),
                matchId,
                author,
                a.getPublishedAt());
    }
}
