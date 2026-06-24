package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A team in the league. Holds a roster of {@link Player}s (Franchise 1—N Player), an in-game
 * leader, season-scoped standings ({@code points}, {@code rank}) recomputed by the scoring engine.
 */
@Entity
@Table(name = "franchises")
@Getter
@Setter
@NoArgsConstructor
public class Franchise extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 16)
    private String tag;

    /** In-game leader (captain). Optional FK to a player on the roster. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "igl_player_id")
    private Player iglPlayer;

    /** Franchise owner (elevated by an admin). Holds owner + manager permissions. Optional. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_player_id")
    private Player ownerPlayer;

    /** Franchise manager (chosen by the owner). At most one per franchise. Optional. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_player_id")
    private Player managerPlayer;

    @Column(name = "season_id")
    private String seasonId;

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(nullable = false)
    private int points = 0;

    @Column(nullable = false)
    private int rank = 0;

    /** Whether the franchise's season is ongoing (true) or finished. */
    @Column(nullable = false)
    private boolean active = true;
}
