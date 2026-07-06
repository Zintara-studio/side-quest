package com.sidequest.arena.repo;

import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByUserId(UUID userId);

    Optional<Player> findByGamerTagIgnoreCase(String gamerTag);

    List<Player> findByFranchiseId(UUID franchiseId);

    List<Player> findByStatus(PlayerStatus status);

    List<Player> findByFranchiseIdAndStatus(UUID franchiseId, PlayerStatus status);

    List<Player> findAllByOrderByPointsDesc();

    /** Leaderboard page: top-N by points with the franchise eager-fetched (avoids a lazy load per row). */
    @EntityGraph(attributePaths = "franchise")
    List<Player> findAllByOrderByPointsDesc(Pageable pageable);

    long countByStatus(PlayerStatus status);

    long countByFranchiseId(UUID franchiseId);
}
