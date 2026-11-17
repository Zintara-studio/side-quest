package com.sidequest.arena.repo;

import com.sidequest.arena.model.FranchisePlayerTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.UUID;

public interface FranchisePlayerTagRepository extends JpaRepository<FranchisePlayerTag, UUID> {

    /** All tags on a franchise's roster — batch-loaded once when building the roster view. */
    List<FranchisePlayerTag> findByFranchiseId(UUID franchiseId);

    @Modifying
    void deleteByFranchiseIdAndPlayerId(UUID franchiseId, UUID playerId);
}
