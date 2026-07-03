package com.sidequest.arena.repo;

import com.sidequest.arena.model.PlayerFranchiseHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlayerFranchiseHistoryRepository extends JpaRepository<PlayerFranchiseHistory, UUID> {

    List<PlayerFranchiseHistory> findBySeasonCodeOrderByFranchiseTagAsc(String seasonCode);

    List<PlayerFranchiseHistory> findByPlayerIdOrderByRecordedAtDesc(UUID playerId);

    List<PlayerFranchiseHistory> findByFranchiseIdAndSeasonCode(UUID franchiseId, String seasonCode);

    void deleteBySeasonCode(String seasonCode);
}
