package com.sidequest.arena.repo;

import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RegistrationRepository extends JpaRepository<Registration, UUID> {

    List<Registration> findAllByOrderByCreatedAtDesc();

    List<Registration> findByStatusOrderByCreatedAtDesc(RegistrationStatus status);

    List<Registration> findByTypeOrderByCreatedAtDesc(RegistrationType type);

    List<Registration> findByStatusAndTypeOrderByCreatedAtDesc(RegistrationStatus status, RegistrationType type);

    List<Registration> findByTypeAndStatus(RegistrationType type, RegistrationStatus status);

    List<Registration> findByPlayerId(UUID playerId);

    List<Registration> findByPlayerIdAndTypeOrderByCreatedAtDesc(UUID playerId, RegistrationType type);

    List<Registration> findByMatchIdAndStatus(UUID matchId, RegistrationStatus status);

    List<Registration> findByMatchId(UUID matchId);

    List<Registration> findByPlayerIdAndMatchId(UUID playerId, UUID matchId);

    long countByStatus(RegistrationStatus status);
}
