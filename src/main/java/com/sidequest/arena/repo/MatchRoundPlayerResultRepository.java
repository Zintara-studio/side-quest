package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchRoundPlayerResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MatchRoundPlayerResultRepository extends JpaRepository<MatchRoundPlayerResult, UUID> {

    List<MatchRoundPlayerResult> findByMatchRoundIdOrderByKillsDesc(UUID matchRoundId);

    @Modifying
    @Query("delete from MatchRoundPlayerResult pr where pr.matchRound.match.id = :matchId")
    void deleteByMatchId(@Param("matchId") UUID matchId);
}
