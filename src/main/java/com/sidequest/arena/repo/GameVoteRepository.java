package com.sidequest.arena.repo;

import com.sidequest.arena.model.GameVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface GameVoteRepository extends JpaRepository<GameVote, UUID> {

    /** The games a given user has upvoted. */
    List<GameVote> findByUserId(UUID userId);

    /** Clears a user's whole vote set — used before re-inserting their new selection (PUT semantics). */
    void deleteByUserId(UUID userId);

    /** Distinct number of users who have cast at least one vote — the popularity denominator. */
    @Query("select count(distinct v.user.id) from GameVote v")
    long countDistinctVoters();

    /** Per-game voter counts as {@code [gameId(UUID), votes(long)]} rows — the popularity numerators. */
    @Query("select v.game.id, count(v) from GameVote v group by v.game.id")
    List<Object[]> countVotesPerGame();
}
