package com.sidequest.arena.repo;

import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {

    List<Match> findAllByOrderByScheduledAtDesc();

    List<Match> findByStatusOrderByScheduledAtDesc(MatchStatus status);

    List<Match> findByGameIdOrderByScheduledAtDesc(UUID gameId);

    List<Match> findByStatusAndGameIdOrderByScheduledAtDesc(MatchStatus status, UUID gameId);

    long countByStatus(MatchStatus status);
}
