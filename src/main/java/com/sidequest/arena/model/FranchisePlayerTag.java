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
 * A franchise-private label a franchise assigns to one of its roster players (e.g. "Valorant 1",
 * "BGMI 2") to designate who they field for a given title. Scoped to (franchise, player) so it is only
 * ever surfaced to that franchise's own leadership — a player moving to another franchise never carries
 * these tags across.
 */
@Entity
@Table(name = "franchise_player_tags", indexes = {
        @Index(name = "idx_fpt_franchise", columnList = "franchise_id"),
        @Index(name = "idx_fpt_franchise_player", columnList = "franchise_id, player_id")
})
@Getter
@Setter
@NoArgsConstructor
public class FranchisePlayerTag extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @Column(nullable = false, length = 40)
    private String label;
}
