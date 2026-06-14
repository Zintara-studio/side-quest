package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.SettingsView;
import com.sidequest.arena.admin.dto.UpdateSettingsRequest;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Read/update of the singleton {@link LeagueSettings} (season + scoring rules). Both operations are
 * admin-gated at the controller.
 */
@Service
public class SettingsService {

    private final LeagueSettingsRepository leagueSettingsRepository;
    private final AuditService auditService;

    public SettingsService(LeagueSettingsRepository leagueSettingsRepository,
                           AuditService auditService) {
        this.leagueSettingsRepository = leagueSettingsRepository;
        this.auditService = auditService;
    }

    /** Current league settings (created with defaults on first access). */
    @Transactional
    public SettingsView get() {
        return toView(getOrCreate());
    }

    /** Apply non-null fields, persist, and audit a summary of what changed. */
    @Transactional
    public SettingsView update(UpdateSettingsRequest request) {
        LeagueSettings settings = getOrCreate();
        List<String> changes = new ArrayList<>();

        if (request.seasonId() != null) {
            settings.setSeasonId(request.seasonId());
            changes.add("seasonId=" + request.seasonId());
        }
        if (request.seasonName() != null) {
            settings.setSeasonName(request.seasonName());
            changes.add("seasonName=" + request.seasonName());
        }
        if (request.pointsPerKill() != null) {
            settings.setPointsPerKill(request.pointsPerKill());
            changes.add("pointsPerKill=" + request.pointsPerKill());
        }
        if (request.placementPoints() != null) {
            settings.setPlacementPoints(request.placementPoints());
            changes.add("placementPoints=" + request.placementPoints());
        }
        if (request.registrationOpen() != null) {
            settings.setRegistrationOpen(request.registrationOpen());
            changes.add("registrationOpen=" + request.registrationOpen());
        }

        LeagueSettings saved = leagueSettingsRepository.save(settings);

        String summary = changes.isEmpty() ? "no changes" : String.join(", ", changes);
        auditService.record("settings.update", "LeagueSettings", "default", summary);

        return toView(saved);
    }

    /** Fetch the singleton row, creating it with defaults if it does not yet exist. */
    private LeagueSettings getOrCreate() {
        return leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID)
                .orElseGet(() -> leagueSettingsRepository.save(new LeagueSettings()));
    }

    private static SettingsView toView(LeagueSettings settings) {
        return new SettingsView(
                settings.getSeasonId(),
                settings.getSeasonName(),
                settings.getPointsPerKill(),
                settings.getPlacementPoints(),
                settings.isRegistrationOpen(),
                settings.getUpdatedAt());
    }
}
