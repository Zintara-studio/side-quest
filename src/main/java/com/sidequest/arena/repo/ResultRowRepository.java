package com.sidequest.arena.repo;

import com.sidequest.arena.model.ResultRow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ResultRowRepository extends JpaRepository<ResultRow, UUID> {

    List<ResultRow> findByMatchIdOrderByRankAsc(UUID matchId);

    List<ResultRow> findByFranchiseIdOrderByCreatedAtDesc(UUID franchiseId);

    void deleteByMatchId(UUID matchId);

    boolean existsByMatchId(UUID matchId);
}
