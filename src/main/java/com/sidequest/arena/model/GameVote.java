package com.sidequest.arena.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A single upvote: one {@link User} likes one {@link Game}. The unique {@code (user_id, game_id)}
 * constraint makes a vote idempotent — a user either upvotes a game or they don't, never twice. A
 * game's popularity is derived from these rows: {@code round(100 * distinct voters for the game /
 * distinct voters overall)}.
 */
@Entity
@Table(name = "game_votes", uniqueConstraints =
        @UniqueConstraint(name = "uk_user_game_vote", columnNames = {"user_id", "game_id"}),
        indexes = @Index(name = "idx_game_vote_game", columnList = "game_id"))
@Getter
@Setter
@NoArgsConstructor
public class GameVote extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    public GameVote(User user, Game game) {
        this.user = user;
        this.game = game;
    }
}
