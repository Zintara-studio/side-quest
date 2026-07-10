package com.sidequest.arena.repo;

import com.sidequest.arena.model.Game;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GameRepository extends JpaRepository<Game, UUID> {

    List<Game> findByEnabledTrueOrderByPopularityDesc();

    List<Game> findAllByOrderByPopularityDesc();
}
