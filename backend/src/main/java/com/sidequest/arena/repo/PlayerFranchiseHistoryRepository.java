package com.sidequest.arena.repo;

import com.sidequest.arena.model.PlayerFranchiseHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PlayerFranchiseHistoryRepository extends JpaRepository<PlayerFranchiseHistory, UUID> {

    void deleteBySeasonCode(String seasonCode);
}
