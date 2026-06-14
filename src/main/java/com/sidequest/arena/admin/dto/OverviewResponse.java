package com.sidequest.arena.admin.dto;

import java.time.Instant;
import java.util.List;

/**
 * Control-room overview: KPIs, aggregate totals and the most recent audit activity.
 *
 * @param pendingRegistrations registrations awaiting review
 * @param resultsToEnter       matches awaiting results (awaiting-result + live)
 * @param openDisputes         disputes still open
 * @param totals               aggregate entity counts
 * @param recentActivity       latest audit-trail rows (up to 10)
 */
public record OverviewResponse(
        long pendingRegistrations,
        long resultsToEnter,
        long openDisputes,
        Totals totals,
        List<ActivityRow> recentActivity
) {

    /**
     * Aggregate counts across the core entities.
     *
     * @param players    total players
     * @param franchises total franchises
     * @param games      total games
     * @param matches    total matches
     * @param users      total users
     */
    public record Totals(
            long players,
            long franchises,
            long games,
            long matches,
            long users
    ) {
    }

    /**
     * A single audit-trail row.
     *
     * @param action     the action performed
     * @param entityType the type of entity affected
     * @param entityId   the id of the entity affected
     * @param actorEmail the email of the actor
     * @param at         when the action occurred
     */
    public record ActivityRow(
            String action,
            String entityType,
            String entityId,
            String actorEmail,
            Instant at
    ) {
    }
}
