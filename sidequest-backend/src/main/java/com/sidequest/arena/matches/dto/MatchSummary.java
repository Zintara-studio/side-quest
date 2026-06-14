package com.sidequest.arena.matches.dto;

import java.time.Instant;
import java.util.List;

/**
 * Fixture-list line: a match with its game, schedule, status, venue/format and the tags of the
 * participating franchises.
 *
 * @param id              the match id
 * @param game            the game this fixture belongs to
 * @param scheduledAt     when the fixture is scheduled
 * @param status          the match status name
 * @param arena           the venue, when set
 * @param format          the played format, when set
 * @param seasonId        the season this fixture belongs to, when set
 * @param participantTags the tags of the participating franchises
 */
public record MatchSummary(
        String id,
        GameMini game,
        Instant scheduledAt,
        String status,
        String arena,
        String format,
        String seasonId,
        List<String> participantTags
) {
}
