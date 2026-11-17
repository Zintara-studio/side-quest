package com.sidequest.arena.seasons.dto;

/**
 * One franchise's frozen final standing in a finished season (history view).
 *
 * @param rank        final rank (1 = best)
 * @param franchiseId franchise id (may reference a now-inactive franchise)
 * @param name        franchise name at season end
 * @param tag         franchise tag at season end
 * @param points      final season points
 */
public record SeasonStandingView(
        int rank,
        String franchiseId,
        String name,
        String tag,
        int points
) {
}
