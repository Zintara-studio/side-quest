package com.sidequest.arena.repo;

import com.sidequest.arena.model.PlayerGameUsername;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlayerGameUsernameRepository extends JpaRepository<PlayerGameUsername, UUID> {

    List<PlayerGameUsername> findByPlayerId(UUID playerId);

    List<PlayerGameUsername> findByPlayerIdAndIsPublicTrue(UUID playerId);
}
