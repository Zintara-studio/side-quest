package com.sidequest.arena.repo;

import com.sidequest.arena.model.PlayerGameUsername;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PlayerGameUsernameRepository extends JpaRepository<PlayerGameUsername, UUID> {

    List<PlayerGameUsername> findByPlayerId(UUID playerId);

    List<PlayerGameUsername> findByPlayerIdAndIsPublicTrue(UUID playerId);

    /** Batch-load handles for many players, eager-fetching the game (avoids the per-player N+1). */
    @EntityGraph(attributePaths = "game")
    List<PlayerGameUsername> findByPlayerIdIn(Collection<UUID> playerIds);
}
