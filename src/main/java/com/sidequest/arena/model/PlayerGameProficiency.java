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

/** Player N—N Game proficiency: a self-rated skill (0–100) for a title the player competes in. */
@Entity
@Table(name = "player_game_proficiencies", uniqueConstraints =
        @UniqueConstraint(name = "uk_player_game", columnNames = {"player_id", "game_id"}))
@Getter
@Setter
@NoArgsConstructor
public class PlayerGameProficiency extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    /** 0–100 self-rated proficiency. */
    @Column(nullable = false)
    private int rating = 50;

    /**
     * Objective rank/tier for this game (e.g. "Immortal 2", "Conqueror", "Faceit 8"). Free-form so any
     * title works; driven by a per-game preset on the client. Nullable.
     */
    @Column(name = "rank_tier")
    private String rankTier;

    /** Self-reported kill/death ratio, nullable. */
    @Column(name = "kd")
    private Double kd;

    /** Self-reported in-game account level, nullable. */
    @Column(name = "account_level")
    private Integer accountLevel;
}
