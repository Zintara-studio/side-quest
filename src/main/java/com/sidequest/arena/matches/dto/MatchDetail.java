package com.sidequest.arena.matches.dto;

import java.time.Instant;
import java.util.List;

/**
 * Full match detail: the fixture's game, schedule, status, venue/format, whether results have been
 * published and the participating-franchise rosters.
 *
 * @param id           the match id
 * @param game         the game this fixture belongs to
 * @param scheduledAt  when the fixture is scheduled
 * @param status       the match status name
 * @param arena        the venue, when set
 * @param format       the played format, when set
 * @param seasonId        the season this fixture belongs to, when set
 * @param hasResults      whether a result table has been published for this match
 * @param matchType       FRANCHISE or FFA
 * @param pointsPerKill   scoring weight: points awarded per kill
 * @param placementPoints scoring weight: comma-separated placement points (highest-first)
 * @param participants    the franchises taking part
 */
public record MatchDetail(
        String id,
        GameMini game,
        Instant scheduledAt,
        String status,
        String arena,
        String format,
        String seasonId,
        boolean hasResults,
        String matchType,
        int pointsPerKill,
        String placementPoints,
        List<ParticipantView> participants
) {
}
