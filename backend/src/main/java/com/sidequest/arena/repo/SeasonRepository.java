package com.sidequest.arena.repo;

import com.sidequest.arena.model.Season;
import com.sidequest.arena.model.SeasonStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SeasonRepository extends JpaRepository<Season, UUID> {

    List<Season> findAllByOrderByStartedAtDesc();

    Optional<Season> findFirstByStatusOrderByStartedAtDesc(SeasonStatus status);

    Optional<Season> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);
}
