package com.sidequest.arena.repo;

import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface RegistrationRepository extends JpaRepository<Registration, UUID> {

    List<Registration> findAllByOrderByCreatedAtDesc();

    List<Registration> findByStatusOrderByCreatedAtDesc(RegistrationStatus status);

    List<Registration> findByTypeOrderByCreatedAtDesc(RegistrationType type);

    List<Registration> findByStatusAndTypeOrderByCreatedAtDesc(RegistrationStatus status, RegistrationType type);

    List<Registration> findByTypeAndStatus(RegistrationType type, RegistrationStatus status);

    /**
     * The standing auction pool source: AUCTION registrations that are ACTIVE and not yet consumed by a
     * prior auction, newest first. The caller still filters out already-rostered players and dedups by
     * player (a player may have re-registered across auction calls). Powers the pool preview shown even
     * when no auction has been created yet.
     */
    List<Registration> findByTypeAndStatusAndConsumedFalseOrderByCreatedAtDesc(
            RegistrationType type, RegistrationStatus status);

    List<Registration> findByPlayerId(UUID playerId);

    /** Batch variant for the auction scout map — all AUCTION regs for a set of players, newest first. */
    List<Registration> findByPlayerIdInAndTypeOrderByCreatedAtDesc(Collection<UUID> playerIds, RegistrationType type);

    List<Registration> findByMatchId(UUID matchId);

    List<Registration> findByPlayerIdAndMatchId(UUID playerId, UUID matchId);

    long countByStatus(RegistrationStatus status);
}
