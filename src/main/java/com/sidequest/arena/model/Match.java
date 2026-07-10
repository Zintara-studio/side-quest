package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A scheduled fixture for a {@link Game}. Participants are tracked via {@link MatchParticipant}
 * (Match N—N Franchise) and results via {@link ResultRow} (Match 1—N ResultRow).
 */
@Entity
@Table(name = "matches", indexes = {
        @Index(name = "idx_matches_status_scheduled", columnList = "status, scheduled_at"),
        @Index(name = "idx_matches_game", columnList = "game_id"),
        @Index(name = "idx_matches_season", columnList = "season_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Match extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MatchStatus status = MatchStatus.SCHEDULED;

    /** Whether this is a franchise match or a free-for-all; drives where participating players come from. */
    @Enumerated(EnumType.STRING)
    @Column(name = "match_type", nullable = false, length = 16)
    private MatchType matchType = MatchType.FRANCHISE;

    @Column(name = "season_id")
    private String seasonId;

    @Column
    private String arena;

    @Column
    private String format;

    /**
     * Lobby / room code for the current live session. Set by an admin when the match is started and
     * shown only to participants in the match room; cleared when the match ends. Nullable.
     */
    @Column(name = "room_id")
    private String roomId;

    /**
     * Scoring weights for this fixture. {@code pointsPerKill} multiplies each kill; {@code placementPoints}
     * is a comma-separated, highest-first list of points awarded by finishing position in a round (e.g.
     * "15,12,10,8,6,4,2,1"). Defaulted from {@link LeagueSettings} at creation and adjustable per match
     * when results are entered.
     */
    @Column(name = "points_per_kill", nullable = false)
    private int pointsPerKill = 1;

    @Column(name = "placement_points", nullable = false, length = 512)
    private String placementPoints = "15,12,10,8,6,4,2,1";

    /** Set once results are published; used to make the scoring job idempotent. */
    @Column(name = "results_published_at")
    private Instant resultsPublishedAt;
}
