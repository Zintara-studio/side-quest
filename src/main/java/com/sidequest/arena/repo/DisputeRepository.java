package com.sidequest.arena.repo;

import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DisputeRepository extends JpaRepository<Dispute, UUID> {

    List<Dispute> findByStatusOrderByCreatedAtDesc(DisputeStatus status);

    List<Dispute> findAllByOrderByCreatedAtDesc();

    List<Dispute> findByRaisedByIdOrderByCreatedAtDesc(UUID raisedById);

    long countByStatus(DisputeStatus status);

    /** Unlink any disputes tied to a match (before the match is deleted; the FK is nullable). */
    @Modifying
    @Query("update Dispute d set d.match = null where d.match.id = :matchId")
    void detachMatch(@Param("matchId") UUID matchId);
}
