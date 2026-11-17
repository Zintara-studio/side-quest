package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.UUID;

public interface MatchMessageRepository extends JpaRepository<MatchMessage, UUID> {

    List<MatchMessage> findByMatchIdOrderByCreatedAtAsc(UUID matchId);

    @Modifying
    void deleteByMatchId(UUID matchId);
}
