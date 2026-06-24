package com.sidequest.arena.matches;

import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.matches.dto.CreateMatchRequest;
import com.sidequest.arena.matches.dto.EnterResultsRequest;
import com.sidequest.arena.matches.dto.EnterRoundsRequest;
import com.sidequest.arena.matches.dto.MatchDetail;
import com.sidequest.arena.matches.dto.MatchPlayerView;
import com.sidequest.arena.matches.dto.MatchRoundView;
import com.sidequest.arena.matches.dto.MatchSummary;
import com.sidequest.arena.matches.dto.ResultView;
import com.sidequest.arena.matches.dto.UpdateMatchRequest;
import com.sidequest.arena.model.MatchStatus;
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
 * Matches (fixtures) API: public reads expose the fixtures grid with filters, per-match detail with
 * rosters, and the per-match leaderboard. Admin-only endpoints schedule fixtures, patch them, and
 * enter/publish results (which feeds the scoring engine and league standings).
 */
@RestController
@RequestMapping("/matches")
public class MatchController {

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    /** Lists fixtures (newest first), optionally filtered by status and/or game, then paginated. */
    @GetMapping
    public PageResponse<MatchSummary> list(
            @RequestParam(required = false) MatchStatus status,
            @RequestParam(required = false) UUID gameId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor) {
        return matchService.list(status, gameId, limit, cursor);
    }

    /** Returns a single fixture with its rosters. 404 if the match does not exist. */
    @GetMapping("/{id}")
    public MatchDetail get(@PathVariable String id) {
        return matchService.get(id);
    }

    /** Returns the published result table for a match, ordered by rank. 404 if the match is missing. */
    @GetMapping("/{id}/leaderboard")
    public List<ResultView> leaderboard(@PathVariable String id) {
        return matchService.leaderboard(id);
    }

    /** Returns the per-round result tables for a match (empty for single-result games). 404 if missing. */
    @GetMapping("/{id}/rounds")
    public List<MatchRoundView> rounds(@PathVariable String id) {
        return matchService.rounds(id);
    }

    /** Returns the players taking part (franchise rosters, or FFA registrations). 404 if missing. */
    @GetMapping("/{id}/players")
    public List<MatchPlayerView> players(@PathVariable String id) {
        return matchService.players(id);
    }

    /** Admin: schedules a new fixture and seeds its roster. Returns 201 with the new detail. */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MatchDetail> create(@Valid @RequestBody CreateMatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(matchService.create(request));
    }

    /** Admin: applies the non-null fields of the request to the fixture and returns the refreshed detail. */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public MatchDetail update(@PathVariable String id, @Valid @RequestBody UpdateMatchRequest request) {
        return matchService.update(id, request);
    }

    /** Admin: enters (or re-publishes) the result table for a match; returns the published leaderboard. */
    @PostMapping("/{id}/results")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ResultView> enterResults(@PathVariable String id, @Valid @RequestBody EnterResultsRequest request) {
        return matchService.enterResults(id, request);
    }

    /** Admin: enters per-round results for a multi-round match; aggregates and returns the leaderboard. */
    @PostMapping("/{id}/rounds")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ResultView> enterRounds(@PathVariable String id, @Valid @RequestBody EnterRoundsRequest request) {
        return matchService.enterRounds(id, request);
    }
}
