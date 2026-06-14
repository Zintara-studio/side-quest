package com.sidequest.arena.repo;

import com.sidequest.arena.model.PlayerGameProficiency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlayerGameProficiencyRepository extends JpaRepository<PlayerGameProficiency, UUID> {

    List<PlayerGameProficiency> findByPlayerId(UUID playerId);

    List<PlayerGameProficiency> findByGameId(UUID gameId);
}
