package com.sidequest.arena.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Join row linking a {@link Match} to a participating {@link Franchise} (the match rosters). */
@Entity
@Table(name = "match_participants",
        uniqueConstraints = @UniqueConstraint(name = "uk_match_franchise", columnNames = {"match_id", "franchise_id"}),
        indexes = @Index(name = "idx_match_participants_franchise", columnList = "franchise_id"))
@Getter
@Setter
@NoArgsConstructor
public class MatchParticipant extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;
}
