package com.sidequest.arena.repo;

import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {

    Optional<Match> findBySlug(String slug);

    List<Match> findAllByOrderByScheduledAtDesc();

    List<Match> findByStatusOrderByScheduledAtDesc(MatchStatus status);

    List<Match> findByGameIdOrderByScheduledAtDesc(UUID gameId);

    List<Match> findByStatusAndGameIdOrderByScheduledAtDesc(MatchStatus status, UUID gameId);

    /**
     * Row-locks a match so concurrent result publishes serialize: the delete-then-insert result rewrite
     * is only idempotent when publishes run one at a time (two interleaved publishes would each see no
     * committed rows to delete and both insert, doubling every total).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Match m where m.id = :id")
    Optional<Match> findByIdForUpdate(@Param("id") UUID id);

    /**
     * The registration lock sweep's bounded candidate set: non-terminal fixtures whose start time is
     * near enough that their lock window could be open — instead of scanning every match ever played.
     */
    List<Match> findByStatusInAndScheduledAtBefore(Collection<MatchStatus> statuses, Instant cutoff);

    long countByStatus(MatchStatus status);
}
