package com.sidequest.arena.repo;

import com.sidequest.arena.model.ResultRow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
            + "and (r.match is null or r.match.status <> com.sidequest.arena.model.MatchStatus.CANCELLED) "
            + "group by r.player.id")
    List<Object[]> aggregateFfaPlayerPoints();

    /**
     * Live-season franchise points, weighted per game: sum of each franchise row's total × the game's
     * standings weight (basis points; 100 = 1.00×), over the season's non-cancelled matches. Rounding is
     * deliberately deferred to the caller (one round per franchise, not per row), so the double sum here
     * must reach Java unrounded. Each row is [franchiseId (UUID), weighted points (Double)].
     */
    @Query("select r.franchise.id, sum(r.total * (coalesce(g.standingsWeight, 100) / 100.0)) "
            + "from ResultRow r join r.match m left join m.game g "
            + "where r.franchise is not null "
            + "and m.status <> com.sidequest.arena.model.MatchStatus.CANCELLED "
            + "and m.seasonId = :season "
            + "group by r.franchise.id")
    List<Object[]> aggregateFranchisePoints(@Param("season") String season);

    void deleteByMatchId(UUID matchId);

    boolean existsByMatchId(UUID matchId);
}
