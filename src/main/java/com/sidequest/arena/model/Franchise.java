package com.sidequest.arena.model;

import jakarta.persistence.Column;
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
 * A team in the league. Holds a roster of {@link Player}s (Franchise 1—N Player), an in-game
 * leader, season-scoped standings ({@code points}, {@code rank}) recomputed by the scoring engine.
 */
@Entity
@Table(name = "franchises", uniqueConstraints = {
        // A franchise name and tag are each unique across the whole league — reserved even after a
        // franchise is discarded (discard only flips active=false, the row stays), so a name can never
        // be reused. Enforced in the service (case-insensitive, ignoring active) + these DB backstops.
        @UniqueConstraint(name = "uk_franchises_name", columnNames = "name"),
        @UniqueConstraint(name = "uk_franchises_tag", columnNames = "tag")
})
@Getter
@Setter
@NoArgsConstructor
public class Franchise extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 16)
    private String tag;

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

    /** Wide hero/banner image url (nullable). */
    @Column(name = "banner_url")
    private String bannerUrl;

    @Column(nullable = false)
    private int points = 0;

    @Column(nullable = false)
    private int rank = 0;

    /** Whether the franchise's season is ongoing (true) or finished. */
    @Column(nullable = false)
    private boolean active = true;
}
