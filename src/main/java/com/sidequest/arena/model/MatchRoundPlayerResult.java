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
 * One player's stat line within a {@link MatchRound} — the optional per-player breakdown an admin can
 * enter instead of (or alongside) the team total. When present, a franchise's round kills are the sum
 * of its players' kills. Always tied to both the player and their franchise for that round.
 */
@Entity
@Table(name = "match_round_player_results", indexes = {
        @Index(name = "idx_mrpr_round", columnList = "match_round_id"),
        @Index(name = "idx_mrpr_player", columnList = "player_id")
})
@Getter
@Setter
@NoArgsConstructor
public class MatchRoundPlayerResult extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_round_id", nullable = false)
    private MatchRound matchRound;

    // The player's franchise for this round (null for FFA matches, where the player has no franchise).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "franchise_id")
    private Franchise franchise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @Column(nullable = false)
    private int kills = 0;

    @Column(name = "survival_seconds", nullable = false)
    private int survivalSeconds = 0;
}
