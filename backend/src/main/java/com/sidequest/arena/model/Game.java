package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A supported title (Valorant, BGMI, CS2, ...). {@code enabled} toggles visibility; {@code popularity}
 * backs the popularity bars. Registration windows are no longer a per-game switch — they are opened
 * per announcement (see {@link Announcement#isRegistrationOpen()}).
 */
@Entity
@Table(name = "games")
@Getter
@Setter
@NoArgsConstructor
public class Game extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String name;

    /** e.g. "5v5", "Battle Royale · Squads", "1v1". */
    @Column(nullable = false)
    private String format;

    /** Genre classification; drives result-entry flow and default per-genre scoring at match creation. */
    @Enumerated(EnumType.STRING)
    @Column(name = "game_type", nullable = false, length = 32)
    private GameType gameType = GameType.TACTICAL;

    @Column(name = "icon_url")
    private String iconUrl;

    @Column(nullable = false)
    private boolean enabled = true;

    /** 0–100 popularity used for the games-grid bars. */
    @Column(nullable = false)
    private int popularity = 0;

    // ---- per-game scoring config (the title's system-wide scoring "meta") ----

    /** Points awarded per kill/score for this title. Seeds each new fixture's snapshot at creation. */
    @Column(name = "points_per_kill", nullable = false)
    private int pointsPerKill = 1;

    /**
     * Placement-points ladder (comma-separated, highest-first, e.g. "15,12,10,8"). Empty = kills only.
     * Seeds each new fixture's snapshot at creation; defaults from the genre when a title is created.
     */
    @Column(name = "placement_points", nullable = false, length = 512)
    private String placementPoints = "";

    /**
     * The title's weight (in basis points, 100 = 1.00×) toward a franchise's OVERALL league standings —
     * so a more competitive title can count for more than a casual one. Applied by the scoring engine
     * when it aggregates the current season's result totals; never rewrites finished-season snapshots.
     */
    @Column(name = "standings_weight", nullable = false)
    private int standingsWeight = 100;
}
