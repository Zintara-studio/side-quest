package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A single franchise's result in one {@link MatchRound} — the per-round, game-specific stat shape
 * (rank, kills, survival time, placement points). Summed across rounds to produce the overall
 * {@link ResultRow}.
 */
@Entity
@Table(name = "match_round_results", indexes = {
        @Index(name = "idx_mrr_round", columnList = "match_round_id")
})
@Getter
@Setter
@NoArgsConstructor
public class MatchRoundResult extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_round_id", nullable = false)
    private MatchRound matchRound;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;

    @Column(nullable = false)
    private int rank = 0;

    @Column(nullable = false)
    private int kills = 0;

    @Column(name = "survival_seconds", nullable = false)
    private int survivalSeconds = 0;

    @Column(name = "place_pts", nullable = false)
    private int placePts = 0;
}
