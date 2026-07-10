package com.sidequest.arena.franchises.dto;

/**
 * Admin payload for {@code PATCH /franchises/:id}. Only non-null fields are applied.
 *
 * @param name      new franchise name (optional)
 * @param tag       new team tag (optional)
 * @param logoUrl   new logo image url (optional)
 * @param bannerUrl new banner image url (optional)
 * @param points    new season points (optional)
 * @param active    new active flag (optional)
 */
public record UpdateFranchiseRequest(
        String name,
        String tag,
        String logoUrl,
        String bannerUrl,
        Integer points,
        Boolean active
) {
}
