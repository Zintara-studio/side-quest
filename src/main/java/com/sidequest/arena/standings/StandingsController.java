package com.sidequest.arena.standings;

import com.sidequest.arena.standings.dto.GameRankRow;
import com.sidequest.arena.standings.dto.PlayerRankRow;
import com.sidequest.arena.standings.dto.StandingsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Standings and leaderboards. The three routes have different roots ({@code /standings},
 * {@code /leaderboard/players}, {@code /leaderboard/games/...}), so this controller declares no
 * class-level base path and puts the full path on each method. Paths exclude the global {@code /v1}
 * context.
 */
@RestController
public class StandingsController {

    private final StandingsService standingsService;

    public StandingsController(StandingsService standingsService) {
        this.standingsService = standingsService;
    }

    /** The franchise league table for the current season. */
    @GetMapping("/standings")
    public StandingsResponse standings() {
        return standingsService.standings();
    }

    /** The top players by points (default 20). */
    @GetMapping("/leaderboard/players")
    public List<PlayerRankRow> topPlayers(@RequestParam(required = false, defaultValue = "20") Integer limit) {
        return standingsService.topPlayers(limit);
    }

    /** Per-title proficiency rankings for a game. 404 if the game does not exist. */
    @GetMapping("/leaderboard/games/{id}")
    public List<GameRankRow> gameRankings(@PathVariable String id) {
        return standingsService.gameRankings(id);
    }
}
