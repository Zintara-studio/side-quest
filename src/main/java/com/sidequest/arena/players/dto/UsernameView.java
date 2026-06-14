package com.sidequest.arena.players.dto;

/**
 * A player's in-game handle for one game.
 *
 * @param gameId   the game id
 * @param gameName the game name
 * @param handle   the in-game handle
 * @param isPublic whether the handle is visible to non-owners
 */
public record UsernameView(
        String gameId,
        String gameName,
        String handle,
        boolean isPublic
) {
}
