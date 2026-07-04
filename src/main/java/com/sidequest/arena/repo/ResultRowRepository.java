package com.sidequest.arena.repo;

import com.sidequest.arena.model.ResultRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ResultRowRepository extends JpaRepository<ResultRow, UUID> {

    List<ResultRow> findByMatchIdOrderByRankAsc(UUID matchId);

    List<ResultRow> findByFranchiseIdOrderByCreatedAtDesc(UUID franchiseId);

    /**
     * Career points per FFA entrant: sum of the player-owned ResultRow totals (kills×ppk + placement)
     * across every FFA match/season. Each row is [playerId (UUID), points (Long)].
     */
    @Query("select r.player.id, sum(r.total) from ResultRow r where r.player is not null "
            + "group by r.player.id")
    List<Object[]> aggregateFfaPlayerPoints();

    void deleteByMatchId(UUID matchId);

    boolean existsByMatchId(UUID matchId);
}
