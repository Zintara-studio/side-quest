package com.sidequest.arena.repo;

import com.sidequest.arena.model.SeasonStanding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SeasonStandingRepository extends JpaRepository<SeasonStanding, UUID> {

    List<SeasonStanding> findBySeasonCodeOrderByRankAsc(String seasonCode);

    void deleteBySeasonCode(String seasonCode);
}
