package com.sidequest.arena.games;

import com.sidequest.arena.games.dto.CreateGameRequest;
import com.sidequest.arena.games.dto.GameDetail;
import com.sidequest.arena.games.dto.GameSummary;
import com.sidequest.arena.games.dto.GameVotesView;
import com.sidequest.arena.games.dto.SaveVotesRequest;
import com.sidequest.arena.games.dto.UpdateGameRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Supported-titles catalogue. Public reads expose the games grid and per-title detail with recent
 * matches; the admin-only patch endpoint toggles visibility/registration and tweaks presentation.
 */
@RestController
@RequestMapping("/games")
public class GameController {

    private final GameService gameService;
    private final GameVoteService gameVoteService;

    public GameController(GameService gameService, GameVoteService gameVoteService) {
        this.gameService = gameService;
        this.gameVoteService = gameVoteService;
    }

    /** Lists supported titles ordered by popularity. {@code enabled=true} restricts to enabled titles. */
    @GetMapping
    public List<GameSummary> list(@RequestParam(required = false) Boolean enabled) {
        return gameService.list(enabled);
    }

    /** The signed-in user's current game upvotes (so the vote UI can pre-select them). 401 if anonymous. */
    @GetMapping("/my-votes")
    public GameVotesView myVotes() {
        return gameVoteService.myVotes();
    }

    /**
     * Replace the signed-in user's game upvotes with the given set and return the refreshed catalogue
     * (popularity recomputed). PUT = idempotent full-set replace. Requires a session.
     */
    @PutMapping("/votes")
    public List<GameSummary> saveVotes(@RequestBody SaveVotesRequest request) {
        return gameVoteService.saveVotes(request);
    }

    /** Returns a single title plus its recent matches. 404 if the game does not exist. */
    @GetMapping("/{id}")
    public GameDetail get(@PathVariable UUID id) {
        return gameService.get(id);
    }

    /** Admin: add a new title (scoring defaults from the genre; tune later via PATCH). 201 on success. */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public GameDetail create(@Valid @RequestBody CreateGameRequest request) {
        return gameService.create(request);
    }

    /** Admin: applies the non-null fields of the request to the game and returns the refreshed detail. */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public GameDetail update(@PathVariable UUID id, @Valid @RequestBody UpdateGameRequest request) {
        return gameService.update(id, request);
    }
}
