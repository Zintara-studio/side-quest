package com.sidequest.arena.repo;

import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByUserId(UUID userId);

    /**
     * Row-locks a player so registration exclusivity guards (one team per match, one pool entry, …)
     * serialize per player: two racing applies/accepts queue here, and the loser re-reads committed
     * state and hits the normal 409s instead of slipping past a check-then-act window.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Player p where p.id = :id")
    Optional<Player> lockById(@Param("id") UUID id);

    Optional<Player> findByGamerTagIgnoreCase(String gamerTag);

    List<Player> findByFranchiseId(UUID franchiseId);

    List<Player> findByStatus(PlayerStatus status);

    /** Directory listing: franchise eager-fetched — toSummary reads it, so this avoids a SELECT per row. */
    @EntityGraph(attributePaths = "franchise")
    List<Player> findAllByOrderByPointsDesc();

    /** Leaderboard page: top-N by points with the franchise eager-fetched (avoids a lazy load per row). */
    @EntityGraph(attributePaths = "franchise")
    List<Player> findAllByOrderByPointsDesc(Pageable pageable);

    long countByStatus(PlayerStatus status);

    long countByFranchiseId(UUID franchiseId);
}
