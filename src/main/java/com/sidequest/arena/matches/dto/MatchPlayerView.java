package com.sidequest.arena.matches.dto;

/**
 * A player taking part in a match. For a FRANCHISE match these are the participating franchises'
 * rostered players; for an FFA match they are the players from the approved registrations tied to the
 * match. {@code franchiseId}/{@code franchiseTag} are null for unaffiliated FFA entrants.
 *
 * @param playerId     the player id
 * @param gamerTag     the player's handle
 * @param franchiseId  the franchise the player is grouped under, or {@code null}
 * @param franchiseTag the franchise tag, or {@code null}
 * @param squadName    the squad name for an FFA squad entry, or {@code null}
 */
public record MatchPlayerView(
        String playerId,
        String gamerTag,
        String franchiseId,
        String franchiseTag,
        String squadName
) {
}
