package com.sidequest.arena.repo;

import com.sidequest.arena.model.InviteStatus;
import com.sidequest.arena.model.TeamInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamInviteRepository extends JpaRepository<TeamInvite, UUID> {

    List<TeamInvite> findByRegistrationIdOrderByCreatedAtAsc(UUID registrationId);

    List<TeamInvite> findByInvitedPlayerIdOrderByCreatedAtDesc(UUID invitedPlayerId);

    Optional<TeamInvite> findByRegistrationIdAndInvitedPlayerId(UUID registrationId, UUID invitedPlayerId);

    boolean existsByRegistrationIdAndInvitedPlayerIdAndStatus(UUID registrationId, UUID invitedPlayerId,
                                                              InviteStatus status);
}
