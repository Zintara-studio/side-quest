package com.sidequest.arena.matches.dto;

import java.util.List;

/**
 * Request body for setting a franchise's fielded lineup for a match: the ids of the roster players to
 * field. An empty or null list clears the lineup (result entry then falls back to the full roster).
 *
 * @param playerIds the player ids to field for this match
 */
public record SetLineupRequest(
        List<String> playerIds
) {
}
