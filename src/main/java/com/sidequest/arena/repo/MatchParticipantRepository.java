package com.sidequest.arena.repo;

import com.sidequest.arena.model.MatchParticipant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface MatchParticipantRepository extends JpaRepository<MatchParticipant, UUID> {

    List<MatchParticipant> findByMatchId(UUID matchId);

    List<MatchParticipant> findByFranchiseId(UUID franchiseId);

    boolean existsByMatchIdAndFranchiseId(UUID matchId, UUID franchiseId);

    /** Batch-load participants for many matches at once, eager-fetching franchise (avoids the per-match N+1). */
    @EntityGraph(attributePaths = "franchise")
    List<MatchParticipant> findByMatchIdIn(Collection<UUID> matchIds);

    /** The set of match ids a franchise participates in — one query instead of a per-match existence check. */
    @Query("select mp.match.id from MatchParticipant mp where mp.franchise.id = :franchiseId")
    Set<UUID> findMatchIdsByFranchiseId(@Param("franchiseId") UUID franchiseId);
}
