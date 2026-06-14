package com.sidequest.arena.standings.dto;

import java.util.List;

/**
 * The franchise league table for a given season.
 *
 * @param season    the season the table belongs to
 * @param standings the ranked rows, best first
 */
public record StandingsResponse(
        String season,
        List<StandingRow> standings
) {
}
