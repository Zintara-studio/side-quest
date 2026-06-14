package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MatchParticipantRepository extends JpaRepository<MatchParticipant, UUID> {

    List<MatchParticipant> findByMatchId(UUID matchId);

    List<MatchParticipant> findByFranchiseId(UUID franchiseId);

    boolean existsByMatchIdAndFranchiseId(UUID matchId, UUID franchiseId);
}
