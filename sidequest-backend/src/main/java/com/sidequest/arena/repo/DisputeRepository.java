package com.sidequest.arena.repo;

import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DisputeRepository extends JpaRepository<Dispute, UUID> {

    List<Dispute> findByStatusOrderByCreatedAtDesc(DisputeStatus status);

    List<Dispute> findAllByOrderByCreatedAtDesc();

    long countByStatus(DisputeStatus status);
}
