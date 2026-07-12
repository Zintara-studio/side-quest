package com.sidequest.arena.players;

import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.players.dto.PlayerDetail;
import com.sidequest.arena.players.dto.PlayerMatchView;
import com.sidequest.arena.players.dto.PlayerSummary;
import com.sidequest.arena.players.dto.UpdatePlayerRequest;
import com.sidequest.arena.players.dto.UpdateStatusRequest;
import com.sidequest.arena.players.dto.UsernameView;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Player directory and profile endpoints: listing/filtering, profile detail, franchise match
 * history, game handles, owner profile edits and admin status changes.
 */
@RestController
@RequestMapping("/players")
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    /** List players (points desc), optionally filtered by franchise, game and status. */
    @GetMapping
    public PageResponse<PlayerSummary> list(
            @RequestParam(required = false) UUID franchiseId,
            @RequestParam(required = false) UUID gameId,
            @RequestParam(required = false) PlayerStatus status,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor) {
        return playerService.list(franchiseId, gameId, status, limit, cursor);
    }

    /** Full profile for a single player. */
    @GetMapping("/{id}")
    public PlayerDetail get(@PathVariable String id) {
        return playerService.get(id);
    }

    /** Match history for the player's franchise. */
    @GetMapping("/{id}/matches")
    public List<PlayerMatchView> matches(@PathVariable String id) {
        return playerService.matches(id);
    }

    /** The player's game handles (all if owner/admin, otherwise only public). */
    @GetMapping("/{id}/usernames")
    public List<UsernameView> usernames(@PathVariable String id) {
        return playerService.usernames(id);
    }

    /** Owner/admin partial update of profile fields. */
    @PatchMapping("/{id}")
    public PlayerDetail update(@PathVariable UUID id,
                              @Valid @RequestBody UpdatePlayerRequest request) {
        return playerService.update(id, request);
    }

    /** Admin-only change of a player's account standing. */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public PlayerDetail updateStatus(@PathVariable UUID id,
                                    @Valid @RequestBody UpdateStatusRequest request) {
        return playerService.updateStatus(id, request);
    }
}
