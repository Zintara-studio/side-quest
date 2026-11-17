package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchLineup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.UUID;

public interface MatchLineupRepository extends JpaRepository<MatchLineup, UUID> {

    List<MatchLineup> findByMatchId(UUID matchId);

    List<MatchLineup> findByMatchIdAndFranchiseId(UUID matchId, UUID franchiseId);

    boolean existsByMatchIdAndFranchiseId(UUID matchId, UUID franchiseId);

    @Modifying
    void deleteByMatchIdAndFranchiseId(UUID matchId, UUID franchiseId);

    @Modifying
    void deleteByMatchId(UUID matchId);
}
