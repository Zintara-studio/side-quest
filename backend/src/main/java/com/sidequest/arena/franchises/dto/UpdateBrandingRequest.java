package com.sidequest.arena.franchises.dto;

/**
 * Self-service branding payload for {@code PATCH /franchises/:id/branding} (franchise owner or admin).
 * Only non-null fields are applied; a blank string clears the image. Values are serving urls returned
 * by {@code POST /media} (e.g. {@code /media/{id}}).
 *
 * @param logoUrl   new logo image url (optional)
 * @param bannerUrl new banner image url (optional)
 */
public record UpdateBrandingRequest(
        String logoUrl,
        String bannerUrl
) {
}
