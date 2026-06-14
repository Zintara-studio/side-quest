package com.sidequest.arena.repo;

import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {

    Optional<Player> findByUserId(UUID userId);

    List<Player> findByFranchiseId(UUID franchiseId);

    List<Player> findByStatus(PlayerStatus status);

    List<Player> findByFranchiseIdAndStatus(UUID franchiseId, PlayerStatus status);

    List<Player> findAllByOrderByPointsDesc();

    long countByStatus(PlayerStatus status);

    long countByFranchiseId(UUID franchiseId);
}
