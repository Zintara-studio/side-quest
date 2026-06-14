package com.sidequest.arena.repo;

import com.sidequest.arena.model.LeagueSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeagueSettingsRepository extends JpaRepository<LeagueSettings, String> {
}
