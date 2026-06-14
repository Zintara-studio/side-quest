package com.sidequest.arena.standings.dto;

/**
 * A single row in the franchise league table.
 *
 * @param rank        1-based position in the table (by points desc, name asc)
 * @param franchiseId franchise id
 * @param name        franchise name
 * @param tag         franchise tag
 * @param points      accumulated season points
 * @param active      whether the franchise's season is ongoing
 */
public record StandingRow(
        int rank,
        String franchiseId,
        String name,
        String tag,
        int points,
        boolean active
) {
}
