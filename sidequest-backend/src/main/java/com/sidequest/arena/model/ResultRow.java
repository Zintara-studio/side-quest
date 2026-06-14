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
 * One franchise's line in a match's result table: kills, placement points, total and final rank.
 * Produced when an admin enters &amp; publishes results.
 */
@Entity
@Table(name = "result_rows")
@Getter
@Setter
@NoArgsConstructor
public class ResultRow extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;

    @Column(nullable = false)
    private int kills = 0;

    @Column(name = "place_pts", nullable = false)
    private int placePts = 0;

    @Column(nullable = false)
    private int total = 0;

    @Column(nullable = false)
    private int rank = 0;
}
