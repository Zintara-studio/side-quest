package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A frozen snapshot of one franchise's final standing in a finished {@link Season}. Captured when a
 * season is finished so historical points/ranks survive even if the live franchise is later edited,
 * carried into a new season (points reset), or discarded.
 */
@Entity
@Table(name = "season_standings", indexes = {
        @Index(name = "idx_season_standings_code", columnList = "season_code")
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
