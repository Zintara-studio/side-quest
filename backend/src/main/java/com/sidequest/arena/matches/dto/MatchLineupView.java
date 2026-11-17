package com.sidequest.arena.matches.dto;

import java.util.List;

/**
 * The fielded lineup a participating franchise has assigned for a match. When {@code lineup} is empty
 * the franchise has not set a lineup and result entry falls back to its full roster.
 *
 * @param franchiseId   the participating franchise's id
 * @param franchiseTag  the franchise's short tag
 * @param franchiseName the franchise's name
 * @param lineup        the assigned players (empty when none set), reusing {@link MatchPlayerView}
 */
public record MatchLineupView(
        String franchiseId,
        String franchiseTag,
        String franchiseName,
        List<MatchPlayerView> lineup
) {
}
