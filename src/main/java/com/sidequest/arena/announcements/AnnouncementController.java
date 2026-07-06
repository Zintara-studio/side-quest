package com.sidequest.arena.announcements;

import com.sidequest.arena.announcements.dto.AnnouncementView;
import com.sidequest.arena.announcements.dto.CreateAnnouncementRequest;
import com.sidequest.arena.announcements.dto.UpdateAnnouncementRequest;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.AnnouncementCategory;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * League announcement feed. Public reads expose the (optionally category-filtered) paginated feed
 * and single posts; admin-only writes create, patch, and delete posts. Paths exclude the global
 * {@code /v1} context.
 */
@RestController
@RequestMapping("/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    /** The announcement feed, newest first, optionally filtered by category and paginated. */
    @GetMapping
    public PageResponse<AnnouncementView> list(
            @RequestParam(required = false) AnnouncementCategory category,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor) {
        return announcementService.list(category, limit, cursor);
    }

    /** A single announcement. 404 if it does not exist. */
    @GetMapping("/{id}")
    public AnnouncementView get(@PathVariable String id) {
        return announcementService.get(id);
    }

    /** Admin: create an announcement and return it with 201. */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnnouncementView> create(@Valid @RequestBody CreateAnnouncementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(announcementService.create(request));
    }

    /** Admin: apply the non-null fields of the request and return the refreshed view. */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public AnnouncementView update(@PathVariable String id,
                                   @Valid @RequestBody UpdateAnnouncementRequest request) {
        return announcementService.update(id, request);
    }

    /** Admin: close a registration call — stops new sign-ups and voids still-open entries. */
    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public AnnouncementView close(@PathVariable String id) {
        return announcementService.close(id);
    }

    /** Admin: delete an announcement. Returns 204 on success, 404 if it does not exist. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        announcementService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
