package com.sidequest.arena.franchises;

import com.sidequest.arena.common.ApiException;
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
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Franchises (teams) API: league table / standings, franchise detail and stats, rosters and
 * played-matches history, plus admin-only create / update / roster assignment.
 */
@RestController
@RequestMapping("/franchises")
public class FranchiseController {

    private final FranchiseService franchiseService;

    public FranchiseController(FranchiseService franchiseService) {
        this.franchiseService = franchiseService;
    }

    /** League table / standings, filtered and paginated. */
    @GetMapping
    public PageResponse<FranchiseSummary> list(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String seasonId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor) {
        return franchiseService.list(active, seasonId, limit, cursor);
    }

    /** Full detail (with stats) for a single franchise. */
    @GetMapping("/{id}")
    public FranchiseDetail get(@PathVariable String id) {
        return franchiseService.get(id);
    }

    /** The players currently on a franchise's roster. */
    @GetMapping("/{id}/roster")
    public List<RosterMember> roster(@PathVariable String id) {
        return franchiseService.roster(id);
    }

    /** Matches the franchise has played, newest first, with results when published. */
    @GetMapping("/{id}/matches")
    public List<FranchiseMatchView> matches(@PathVariable String id) {
        return franchiseService.matches(id);
    }

    /** Create a franchise (admin only). */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FranchiseDetail> create(@Valid @RequestBody CreateFranchiseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(franchiseService.create(request));
    }

    /** Update a franchise's fields and/or in-game leader (admin only). */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public FranchiseDetail update(@PathVariable String id, @Valid @RequestBody UpdateFranchiseRequest request) {
        return franchiseService.update(id, request);
    }

    /** Assign a player to the franchise's roster (admin only); returns the updated roster. */
    @PostMapping("/{id}/roster")
    @PreAuthorize("hasRole('ADMIN')")
    public List<RosterMember> assignPlayer(@PathVariable String id, @Valid @RequestBody AssignPlayerRequest request) {
        return franchiseService.assignPlayer(id, request);
    }

    /** Elevate a player to franchise owner (admin only). */
    @PostMapping("/{id}/owner")
    @PreAuthorize("hasRole('ADMIN')")
    public FranchiseDetail setOwner(@PathVariable String id, @Valid @RequestBody AssignRoleRequest request) {
        return franchiseService.setOwner(id, request);
    }

    /** Candidate players for this franchise's owner/manager slot (admin or the franchise owner). */
    @GetMapping("/{id}/eligible-owners")
    @PreAuthorize("hasAnyRole('ADMIN','FRANCHISE_OWNER')")
    public List<FranchiseDetail.PersonView> eligibleOwners(@PathVariable String id) {
        return franchiseService.eligiblePlayers(parseId(id, "Franchise"));
    }

    /** Create a franchise from an approved franchise-creation proposal / registration (admin only). */
    @PostMapping("/from-proposal/{registrationId}")
    @PreAuthorize("hasRole('ADMIN')")
    public FranchiseDetail createFromProposal(@PathVariable String registrationId) {
        return franchiseService.createFromProposal(parseId(registrationId, "Registration"));
    }

    /** Set the franchise manager (admin or the franchise owner; ownership enforced in the service). */
    @PostMapping("/{id}/manager")
    @PreAuthorize("hasAnyRole('ADMIN','FRANCHISE_OWNER')")
    public FranchiseDetail setManager(@PathVariable String id, @Valid @RequestBody AssignRoleRequest request) {
        return franchiseService.setManager(id, request);
    }

    /** Discard (deactivate) a franchise (admin only; blocked during an active season). */
    @PostMapping("/{id}/discard")
    @PreAuthorize("hasRole('ADMIN')")
    public FranchiseDetail discard(@PathVariable String id) {
        return franchiseService.discard(id);
    }

    /** Bring a previously discarded franchise back into the league (admin only). */
    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public FranchiseDetail restore(@PathVariable String id) {
        return franchiseService.restore(id);
    }

    // ---- owner/manager invites (owner or admin; enforced in the service) ----

    /** The current user's franchise plus their role on it; 200 with a null body when they have none. */
    @GetMapping("/mine")
    public FranchiseMineView mine() {
        return franchiseService.myFranchise();
    }

    /** Owner/manager invitations addressed to the current player. */
    @GetMapping("/invites/mine")
    public List<FranchiseInviteView> myInvites() {
        return franchiseService.myInvites();
    }

    /** Invite a player to be the franchise's new owner or manager (owner or admin; enforced in service). */
    @PostMapping("/{id}/invites")
    public FranchiseInviteView createInvite(@PathVariable String id,
                                            @Valid @RequestBody FranchiseInviteRequest request) {
        return franchiseService.createInvite(id, request);
    }

    /** Pending owner/manager invites a franchise has outstanding (owner or admin). */
    @GetMapping("/{id}/invites")
    public List<FranchiseInviteView> pendingInvites(@PathVariable String id) {
        return franchiseService.franchisePendingInvites(id);
    }

    /** The invited player accepts a franchise owner/manager invite. */
    @PostMapping("/invites/{inviteId}/accept")
    public FranchiseInviteView acceptInvite(@PathVariable String inviteId) {
        return franchiseService.respondToInvite(inviteId, true);
    }

    /** The invited player rejects a franchise owner/manager invite. */
    @PostMapping("/invites/{inviteId}/reject")
    public FranchiseInviteView rejectInvite(@PathVariable String inviteId) {
        return franchiseService.respondToInvite(inviteId, false);
    }

    /** Parse a path id to UUID; an unparseable id can never match, so report it as not found. */
    private static UUID parseId(String id, String resource) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound(resource, id);
        }
    }
}
