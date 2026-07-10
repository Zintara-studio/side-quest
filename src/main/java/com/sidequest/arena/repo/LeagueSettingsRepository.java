package com.sidequest.arena.repo;

import com.sidequest.arena.model.LeagueSettings;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface LeagueSettingsRepository extends JpaRepository<LeagueSettings, String> {

    /**
     * Row-locks the settings singleton. Season lifecycle transitions (finish/start) acquire this first
     * so two concurrent transitions serialize on one existing row — the loser re-reads committed state
     * and hits the normal 409 guards instead of double-snapshotting / double-starting.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from LeagueSettings s where s.id = :id")
    Optional<LeagueSettings> lockById(@Param("id") String id);
}
