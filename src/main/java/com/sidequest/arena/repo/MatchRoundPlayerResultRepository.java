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

    /**
     * Career kill-points per player from FRANCHISE matches: sum of each player's kills weighted by the
     * match's pointsPerKill, across every round/season. Each row is [playerId (UUID), points (Long)].
     * Restricted to franchise != null so FFA per-player breakdown rows are excluded here — FFA credit
     * is counted once via the player-owned ResultRow (see {@code aggregateFfaPlayerPoints}); otherwise
     * an FFA entrant's kills would be double-counted.
     */
    @Query("select pr.player.id, sum(pr.kills * pr.matchRound.match.pointsPerKill) "
            + "from MatchRoundPlayerResult pr where pr.player is not null and pr.franchise is not null "
            + "group by pr.player.id")
    List<Object[]> aggregatePlayerKillPoints();

    @Modifying
    @Query("delete from MatchRoundPlayerResult pr where pr.matchRound.match.id = :matchId")
    void deleteByMatchId(@Param("matchId") UUID matchId);
}
