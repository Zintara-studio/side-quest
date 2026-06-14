package com.sidequest.arena.franchises.dto;

/**
 * Full view of a single franchise for {@code GET /franchises/:id}: standings, the in-game leader,
 * and aggregate stats (roster size, matches played).
 *
 * @param id            franchise id
 * @param name          franchise name
 * @param tag           short team tag
 * @param logoUrl       logo image url (nullable)
 * @param points        season points
 * @param rank          current standings rank
 * @param active        whether the franchise's season is ongoing
 * @param seasonId      season the franchise belongs to (nullable)
 * @param igl           the in-game leader, or {@code null} if none is set
 * @param rosterSize    number of players currently on the roster
 * @param matchesPlayed number of matches the franchise has participated in
 */
public record FranchiseDetail(
        String id,
        String name,
        String tag,
        String logoUrl,
        int points,
        int rank,
        boolean active,
        String seasonId,
        IglView igl,
        long rosterSize,
        long matchesPlayed
) {

    /** The in-game leader (captain) summary, or {@code null} when no IGL is assigned. */
    public record IglView(
            String playerId,
            String gamerTag
    ) {
    }
}
