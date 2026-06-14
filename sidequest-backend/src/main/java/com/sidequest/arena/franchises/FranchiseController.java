package com.sidequest.arena.franchises;

import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.franchises.dto.AssignPlayerRequest;
import com.sidequest.arena.franchises.dto.CreateFranchiseRequest;
import com.sidequest.arena.franchises.dto.FranchiseDetail;
import com.sidequest.arena.franchises.dto.FranchiseMatchView;
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
}
