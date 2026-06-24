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
 * One round/map of a multi-round match (e.g. a BGMI lobby plays several maps). Single-result games
 * (Valorant, CS2) have no rounds — their {@link ResultRow}s are entered directly. Per-round results
 * live in {@link MatchRoundResult} and are aggregated into the overall {@link ResultRow}s.
 */
@Entity
@Table(name = "match_rounds", indexes = {
        @Index(name = "idx_match_rounds_match", columnList = "match_id")
})
@Getter
@Setter
@NoArgsConstructor
public class MatchRound extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @Column(name = "round_number", nullable = false)
    private int roundNumber;

    @Column(name = "map_name")
    private String mapName;

    @Column
    private String mode;
}
