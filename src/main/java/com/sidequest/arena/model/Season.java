package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A competitive season. Franchises, matches and standings are scoped to a season by its {@link #code}
 * (e.g. "S04"). Exactly one season is {@link SeasonStatus#ACTIVE}; finishing a season snapshots its
 * final franchise standings into {@link SeasonStanding} for historical browsing.
 */
@Entity
@Table(name = "seasons")
@Getter
@Setter
@NoArgsConstructor
public class Season extends BaseEntity {

    /** Stable season code used as the seasonId across franchises/matches (e.g. "S04"). */
    @Column(nullable = false, unique = true, length = 32)
    private String code;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SeasonStatus status = SeasonStatus.ACTIVE;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;
}
