package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "matches")
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

    @Column(name = "season_id")
    private String seasonId;

    @Column
    private String arena;

    @Column
    private String format;

    /** Set once results are published; used to make the scoring job idempotent. */
    @Column(name = "results_published_at")
    private Instant resultsPublishedAt;
}
