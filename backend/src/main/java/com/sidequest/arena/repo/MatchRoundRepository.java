package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchRound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MatchRoundRepository extends JpaRepository<MatchRound, UUID> {

    List<MatchRound> findByMatchIdOrderByRoundNumberAsc(UUID matchId);

    @Modifying
    @Query("delete from MatchRound r where r.match.id = :matchId")
    void deleteByMatchId(@Param("matchId") UUID matchId);
}
