package com.sidequest.arena.repo;

import com.sidequest.arena.model.FranchiseInvite;
import com.sidequest.arena.model.InviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FranchiseInviteRepository extends JpaRepository<FranchiseInvite, UUID> {

    List<FranchiseInvite> findByInvitedPlayerIdOrderByCreatedAtDesc(UUID invitedPlayerId);

    List<FranchiseInvite> findByFranchiseIdAndStatusOrderByCreatedAtDesc(UUID franchiseId, InviteStatus status);

    Optional<FranchiseInvite> findByFranchiseIdAndInvitedPlayerId(UUID franchiseId, UUID invitedPlayerId);
}
