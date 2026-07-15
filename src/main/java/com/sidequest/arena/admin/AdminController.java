package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.DisputeView;
import com.sidequest.arena.admin.dto.OverviewResponse;
import com.sidequest.arena.admin.dto.ResolveDisputeRequest;
import com.sidequest.arena.admin.dto.SeedResult;
import com.sidequest.arena.admin.dto.TeamMember;
import com.sidequest.arena.admin.dto.UpdateAvatarRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin control-room endpoints: overview KPIs, dispute triage and the staff roster. All admin-only.
 */
@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    /** Control-room KPIs, totals and recent activity. */
    @GetMapping("/overview")
    public OverviewResponse overview() {
        return adminService.overview();
    }

    /**
     * Set the calling admin's own account-level avatar (for admins with no player profile — chiefly the
     * league admin — so they can still have a profile picture). Self-scoped: only the caller's own
     * account is touched. 204 on success; the client re-fetches {@code /auth/me} for the new value.
     */
    @PatchMapping("/profile/avatar")
    public ResponseEntity<Void> updateOwnAvatar(@Valid @RequestBody UpdateAvatarRequest request) {
        adminService.updateOwnAvatar(request);
        return ResponseEntity.noContent().build();
    }

    /** Open disputes awaiting triage. */
    @GetMapping("/disputes")
    public List<DisputeView> disputes() {
        return adminService.openDisputes();
    }

    /** Resolve or dismiss a dispute. */
    @PostMapping("/disputes/{id}/resolve")
    public DisputeView resolveDispute(@PathVariable String id,
                                      @Valid @RequestBody ResolveDisputeRequest request) {
        return adminService.resolveDispute(id, request);
    }

    /** Staff roster: admins and franchise managers. */
    @GetMapping("/team")
    public List<TeamMember> team() {
        return adminService.team();
    }

    /** Main admin only: seed static config (games catalogue) into the DB without a restart. */
    @PostMapping("/seed")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public SeedResult seed() {
        return adminService.seedStaticConfig();
    }

    /** Main admin only: appoint a player as an admin. */
    @PostMapping("/players/{playerId}/admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public TeamMember appointAdmin(@PathVariable String playerId) {
        return adminService.appointAdmin(playerId);
    }

    /** Main admin only: revoke an appointed admin (immediately ends their admin sessions). */
    @DeleteMapping("/players/{playerId}/admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> revokeAdmin(@PathVariable String playerId) {
        adminService.revokeAdmin(playerId);
        return ResponseEntity.noContent().build();
    }
}
