package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A player's in-game handle for a specific {@link Game}, optionally hidden from the public. */
@Entity
@Table(name = "player_game_usernames", indexes = {
        @Index(name = "idx_pgu_player", columnList = "player_id")
})
@Getter
@Setter
@NoArgsConstructor
public class PlayerGameUsername extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(nullable = false)
    private String handle;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic = true;
}
