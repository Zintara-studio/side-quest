package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A frozen snapshot of one franchise's final standing in a finished {@link Season}. Captured when a
 * season is finished so historical points/ranks survive even if the live franchise is later edited,
 * carried into a new season (points reset), or discarded.
 *
 * <p>The (season_code, franchise_id) unique constraint is the backstop against concurrent
 * {@code finish()} calls double-inserting a snapshot — the all-time table sums these rows, so a
 * duplicate would double-count that season forever.
 */
@Entity
@Table(name = "season_standings", indexes = {
        @Index(name = "idx_season_standings_code", columnList = "season_code")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_season_standing", columnNames = {"season_code", "franchise_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class SeasonStanding extends BaseEntity {

    @Column(name = "season_code", nullable = false, length = 32)
    private String seasonCode;

    @Column(name = "franchise_id", nullable = false)
    private String franchiseId;

    @Column(name = "franchise_name", nullable = false)
    private String franchiseName;

    @Column(name = "franchise_tag", length = 16)
    private String franchiseTag;

    @Column(nullable = false)
    private int points;

    @Column(nullable = false)
    private int rank;
}
