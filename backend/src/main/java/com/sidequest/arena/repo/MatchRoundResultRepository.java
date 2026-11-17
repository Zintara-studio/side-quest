package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchRoundResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MatchRoundResultRepository extends JpaRepository<MatchRoundResult, UUID> {

    List<MatchRoundResult> findByMatchRoundIdOrderByRankAsc(UUID matchRoundId);

    @Modifying
    @Query("delete from MatchRoundResult rr where rr.matchRound.match.id = :matchId")
    void deleteByMatchId(@Param("matchId") UUID matchId);
}
