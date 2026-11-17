package com.sidequest.arena.franchises.dto;

/**
 * League-table row for a franchise: standings fields plus the current roster size. Used by
 * {@code GET /franchises} (sorted by points desc, then name asc).
 *
 * @param id         franchise id
 * @param name       franchise name
 * @param tag        short team tag
 * @param logoUrl    logo image url (nullable)
 * @param points     season points
 * @param rank       current standings rank
 * @param active     whether the franchise's season is ongoing
 * @param seasonId   season the franchise belongs to (nullable)
 * @param rosterSize number of players currently on the roster
 */
public record FranchiseSummary(
        String id,
        String name,
        String tag,
        String logoUrl,
        int points,
        int rank,
        boolean active,
        String seasonId,
        long rosterSize
) {
}
