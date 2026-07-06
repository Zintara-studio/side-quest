package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A competitor profile, 1:1 with a {@link User}. May belong to a {@link Franchise} (assigned via
 * auction). {@code points} accumulates from match results and drives the player leaderboard.
 */
@Entity
@Table(name = "players", indexes = {
        @Index(name = "idx_players_franchise", columnList = "franchise_id"),
        @Index(name = "idx_players_points", columnList = "points")
})
@Getter
@Setter
@NoArgsConstructor
public class Player extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "franchise_id")
    private Franchise franchise;

    /** Public handle shown across the platform (defaults to the user's name). */
    @Column(name = "gamer_tag", nullable = false)
    private String gamerTag;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column
    private String region;

    @Column(columnDefinition = "text")
    private String bio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PlayerStatus status = PlayerStatus.PENDING;

    @Column(nullable = false)
    private int points = 0;
}
