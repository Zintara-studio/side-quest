package com.sidequest.arena.franchises.dto;

/**
 * Admin payload for {@code PATCH /franchises/:id}. Only non-null fields are applied. When
 * {@code iglPlayerId} is present, that player is loaded and set as the in-game leader.
 *
 * @param name        new franchise name (optional)
 * @param tag         new team tag (optional)
 * @param logoUrl     new logo image url (optional)
 * @param points      new season points (optional)
 * @param active      new active flag (optional)
 * @param iglPlayerId id of the player to set as in-game leader (optional)
 */
public record UpdateFranchiseRequest(
        String name,
        String tag,
        String logoUrl,
        Integer points,
        Boolean active,
        String iglPlayerId
) {
}
