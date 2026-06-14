package com.sidequest.arena.matches.dto;

/**
 * One franchise's line in a published match result table.
 *
 * @param rank          the franchise's final rank in this match (1 = best)
 * @param franchiseId   the franchise id
 * @param franchiseName the franchise name
 * @param franchiseTag  the franchise short tag
 * @param kills         kill points scored
 * @param placePts      placement points scored
 * @param total         total points (kills + placePts)
 */
public record ResultView(
        int rank,
        String franchiseId,
        String franchiseName,
        String franchiseTag,
        int kills,
        int placePts,
        int total
) {
}
