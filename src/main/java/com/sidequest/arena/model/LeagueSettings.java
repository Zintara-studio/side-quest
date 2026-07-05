package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Singleton league configuration (season + scoring rules) edited from admin settings. Stored as a
 * single row keyed by {@link #SINGLETON_ID}.
 */
@Entity
@Table(name = "league_settings")
@Getter
@Setter
@NoArgsConstructor
public class LeagueSettings {

    public static final String SINGLETON_ID = "default";

    @Id
    @Column(length = 32)
    private String id = SINGLETON_ID;

    @Column(name = "season_id", nullable = false)
    private String seasonId = "S04";

    @Column(name = "season_name", nullable = false)
    private String seasonName = "Season 04";

    /** Points awarded per kill in the scoring engine. */
    @Column(name = "points_per_kill", nullable = false)
    private int pointsPerKill = 1;

    /**
     * Placement points by finishing position, highest-first, as a comma-separated list.
     * e.g. "15,12,10,8,6,4,2,1" → 1st gets 15, 2nd gets 12, ...
     */
    @Column(name = "placement_points", nullable = false, length = 512)
    private String placementPoints = "15,12,10,8,6,4,2,1";

    /** Master switch for registrations across the league. */
    @Column(name = "registration_open", nullable = false)
    private boolean registrationOpen = true;

    /**
     * How many hours before a match its registration locks: past this point no new entries or invites,
     * the confirmed roster is frozen, and any still-pending invites are voided.
     */
    @Column(name = "registration_lock_hours", nullable = false)
    private int registrationLockHours = 3;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
