package com.sidequest.arena.seasons;

import com.sidequest.arena.seasons.dto.SeasonStandingView;
import com.sidequest.arena.seasons.dto.SeasonView;
import com.sidequest.arena.seasons.dto.StartSeasonRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Seasons API: public reads (list, current, a season's standings/history) and admin-only lifecycle
 * actions (start a new season, finish the current one).
 */
@RestController
@RequestMapping("/seasons")
public class SeasonController {

    private final SeasonService seasonService;

    public SeasonController(SeasonService seasonService) {
        this.seasonService = seasonService;
    }

    /** All seasons, newest first. */
    @GetMapping
    public List<SeasonView> list() {
        return seasonService.list();
    }

    /** The current (active) season, or 204-style null body when between seasons. */
    @GetMapping("/current")
    public SeasonView current() {
        return seasonService.current();
    }

    /** Combined all-time standings: total points per franchise across every season plus live points. */
    @GetMapping("/all-time/standings")
    public List<SeasonStandingView> allTimeStandings() {
        return seasonService.allTimeStandings();
    }

    /** Standings for a season by code — live for the active season, the frozen snapshot otherwise. */
    @GetMapping("/{code}/standings")
    public List<SeasonStandingView> standings(@PathVariable String code) {
        return seasonService.standings(code);
    }

    /** Main admin only: start a new season (finishing the current one first) — irreversible in-app. */
    @PostMapping("/start")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public SeasonView start(@Valid @RequestBody StartSeasonRequest request) {
        return seasonService.start(request);
    }

    /** Main admin only: finish the active season (freezes its standings — no in-app undo). */
    @PostMapping("/finish")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public SeasonView finish() {
        return seasonService.finish();
    }
}
