package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A frozen record of one player's membership on a franchise for a given season, captured when a
 * season is finished (before rosters are reset). One row is written per roster player per franchise,
 * tagging the {@link #role} they held (OWNER / MANAGER / PLAYER). Survives roster resets so a
 * player's franchise history and a franchise's past rosters can be browsed after the fact.
 */
@Entity
@Table(name = "player_franchise_history", indexes = {
        @Index(name = "idx_pfh_season_code", columnList = "season_code"),
        @Index(name = "idx_pfh_player_id", columnList = "player_id"),
        @Index(name = "idx_pfh_franchise_id", columnList = "franchise_id")
})
@Getter
@Setter
@NoArgsConstructor
public class PlayerFranchiseHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(name = "player_gamer_tag", nullable = false)
    private String playerGamerTag;

    @Column(name = "franchise_id", nullable = false)
    private UUID franchiseId;

    @Column(name = "franchise_name", nullable = false)
    private String franchiseName;

    @Column(name = "franchise_tag", length = 16)
    private String franchiseTag;

    @Column(name = "season_code", nullable = false, length = 32)
    private String seasonCode;

    /** The role the player held on the franchise for this season: OWNER, MANAGER or PLAYER. */
    @Column(nullable = false, length = 16)
    private String role;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @PrePersist
    void onCreate() {
        if (recordedAt == null) {
            recordedAt = Instant.now();
        }
    }
}
