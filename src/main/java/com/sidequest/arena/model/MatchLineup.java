package com.sidequest.arena.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Join row naming a {@link Player} fielded by a participating {@link Franchise} for a specific
 * {@link Match} — the per-match lineup. When a franchise has any lineup rows for a match, result
 * entry uses that subset instead of the franchise's full roster.
 */
@Entity
@Table(name = "match_lineups", uniqueConstraints =
        @UniqueConstraint(name = "uk_match_franchise_player",
                columnNames = {"match_id", "franchise_id", "player_id"}))
@Getter
@Setter
@NoArgsConstructor
public class MatchLineup extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;
}
