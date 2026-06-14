package com.sidequest.arena.players.dto;

/**
 * Partial-update payload for {@code PATCH /players/{id}}. All fields are optional; only non-null
 * fields are applied to the profile.
 *
 * @param gamerTag  new public handle (nullable)
 * @param avatarUrl new avatar url (nullable)
 * @param region    new region (nullable)
 * @param bio       new bio (nullable)
 */
public record UpdatePlayerRequest(
        String gamerTag,
        String avatarUrl,
        String region,
        String bio
) {
}
