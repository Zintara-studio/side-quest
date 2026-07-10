package com.sidequest.arena.franchises.dto;

/**
 * Full view of a single franchise for {@code GET /franchises/:id}: standings, the in-game leader,
 * and aggregate stats (roster size, matches played).
 *
 * @param id            franchise id
 * @param name          franchise name
 * @param tag           short team tag
 * @param logoUrl       logo image url (nullable)
 * @param bannerUrl     wide banner image url (nullable)
 * @param points        season points
 * @param rank          current standings rank
 * @param active        whether the franchise's season is ongoing
 * @param seasonId      season the franchise belongs to (nullable)
 * @param owner         the franchise owner, or {@code null} if none is set
 * @param manager       the franchise manager, or {@code null} if none is set
 * @param rosterSize    number of players currently on the roster
 * @param matchesPlayed number of matches the franchise has participated in
 */
public record FranchiseDetail(
        String id,
        String name,
        String tag,
        String logoUrl,
        String bannerUrl,
        int points,
        int rank,
        boolean active,
        String seasonId,
        PersonView owner,
        PersonView manager,
        long rosterSize,
        long matchesPlayed
) {

    /** A player holding a franchise role (owner / manager), or {@code null} when unassigned. */
    public record PersonView(
            String playerId,
            String gamerTag
    ) {
    }
}
