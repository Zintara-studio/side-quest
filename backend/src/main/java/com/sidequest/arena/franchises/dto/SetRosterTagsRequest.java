package com.sidequest.arena.franchises.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Body for {@code PUT /franchises/{id}/roster/{playerId}/tags} — set the franchise-private designation
 * tags (e.g. "Valorant 1") on one of the franchise's roster players. Replaces the player's current tags
 * for this franchise. An empty/absent list clears them.
 *
 * <p>The list and per-element sizes are capped to mirror the server-side limits ({@code ≤ 20} tags,
 * {@code ≤ 40} chars each), so an oversized payload is rejected up front rather than walked element by
 * element in the service.
 *
 * @param tags the labels to assign (trimmed, de-duplicated and capped server-side)
 */
public record SetRosterTagsRequest(
        @Size(max = 20, message = "At most 20 tags are allowed.")
        List<@NotBlank @Size(max = 40, message = "A tag can be at most 40 characters.") String> tags
) {
}
