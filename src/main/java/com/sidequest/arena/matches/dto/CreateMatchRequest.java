package com.sidequest.arena.matches.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

/**
 * Admin request to schedule a new fixture. The match is created in {@code SCHEDULED} status; each id
 * in {@code participantFranchiseIds} is added to the match roster.
 *
 * @param gameId                  the game the fixture belongs to (required)
 * @param scheduledAt             when the fixture is scheduled (required)
 * @param arena                   the venue, optional
 * @param format                  the played format, optional
 * @param seasonId                the season this fixture belongs to, optional
 * @param participantFranchiseIds franchise ids to seed the roster with, optional
 */
public record CreateMatchRequest(
        @NotBlank String gameId,
        @NotNull Instant scheduledAt,
        String arena,
        String format,
        String seasonId,
        List<String> participantFranchiseIds
) {
}
