package com.sidequest.arena.seasons;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Season;
import com.sidequest.arena.model.SeasonStanding;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.SeasonRepository;
import com.sidequest.arena.repo.SeasonStandingRepository;
import com.sidequest.arena.seasons.dto.SeasonStandingView;
import com.sidequest.arena.seasons.dto.SeasonView;
import com.sidequest.arena.seasons.dto.StartSeasonRequest;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Season lifecycle: list seasons, resolve the current season, browse a finished season's frozen
 * standings, and the admin start/finish operations. Finishing a season snapshots its final franchise
 * standings into {@link SeasonStanding}; starting one finalizes the current season, then carries the
 * franchises into the new season with points reset to zero (points are season-scoped).
 */
@Service
public class SeasonService {

    private final SeasonRepository seasonRepository;
    private final SeasonStandingRepository seasonStandingRepository;
    private final FranchiseRepository franchiseRepository;
    private final LeagueSettingsRepository leagueSettingsRepository;
    private final AuditService auditService;

    public SeasonService(SeasonRepository seasonRepository,
                         SeasonStandingRepository seasonStandingRepository,
                         FranchiseRepository franchiseRepository,
                         LeagueSettingsRepository leagueSettingsRepository,
                         AuditService auditService) {
        this.seasonRepository = seasonRepository;
        this.seasonStandingRepository = seasonStandingRepository;
        this.franchiseRepository = franchiseRepository;
        this.leagueSettingsRepository = leagueSettingsRepository;
        this.auditService = auditService;
    }

    /** All seasons, newest first. */
    @Transactional(readOnly = true)
    public List<SeasonView> list() {
        Season current = activeOrNull();
        return seasonRepository.findAllByOrderByStartedAtDesc().stream()
                .map(s -> toView(s, current))
                .toList();
    }

    /** The current (active) season, or {@code null} when the league is between seasons. */
    @Transactional(readOnly = true)
    public SeasonView current() {
        Season active = activeOrNull();
        return active == null ? null : toView(active, active);
    }

    /**
     * Standings for a season by code: live franchise standings for the active season, or the frozen
     * snapshot for a finished season. 404 if the code is unknown.
     */
    @Transactional(readOnly = true)
    public List<SeasonStandingView> standings(String code) {
        Season season = seasonRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> ApiException.notFound("Season", code));

        if (season.getStatus() == SeasonStatus.ACTIVE) {
            return liveStandings(season.getCode());
        }
        return seasonStandingRepository.findBySeasonCodeOrderByRankAsc(season.getCode()).stream()
                .map(s -> new SeasonStandingView(s.getRank(), s.getFranchiseId(),
                        s.getFranchiseName(), s.getFranchiseTag(), s.getPoints()))
                .toList();
    }

    /**
     * Admin: finish the active season — snapshot its franchises' final standings and mark it FINISHED.
     * Idempotent per season (re-snapshots). 409 if there is no active season.
     */
    @CacheEvict(cacheNames = {CacheConfig.STANDINGS, CacheConfig.FRANCHISES}, allEntries = true)
    @Transactional
    public SeasonView finish() {
        Season active = seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE)
                .orElseThrow(() -> ApiException.conflict("No active season to finish"));
        snapshot(active.getCode());
        active.setStatus(SeasonStatus.FINISHED);
        active.setEndedAt(Instant.now());
        Season saved = seasonRepository.save(active);
        auditService.record("season.finish", "Season", saved.getCode(),
                "Finished " + saved.getName());
        return toView(saved, null);
    }

    /**
     * Admin: start a new season. Any active season is finished (and snapshotted) first. The new season
     * becomes current, league settings are repointed to it, and every franchise is carried forward with
     * points/rank reset to zero (season-scoped points). 409 if the code already exists.
     */
    @CacheEvict(cacheNames = {CacheConfig.STANDINGS, CacheConfig.FRANCHISES, CacheConfig.PLAYERS,
            CacheConfig.LEADERBOARD_PLAYERS}, allEntries = true)
    @Transactional
    public SeasonView start(StartSeasonRequest req) {
        String code = req.code().trim();
        if (seasonRepository.existsByCodeIgnoreCase(code)) {
            throw ApiException.conflict("A season with code '" + code + "' already exists");
        }

        // Finalize the outgoing season, if any.
        seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE).ifPresent(active -> {
            snapshot(active.getCode());
            active.setStatus(SeasonStatus.FINISHED);
            active.setEndedAt(Instant.now());
            seasonRepository.save(active);
        });

        Season season = new Season();
        season.setCode(code);
        season.setName(req.name().trim());
        season.setStatus(SeasonStatus.ACTIVE);
        season.setStartedAt(Instant.now());
        Season saved = seasonRepository.save(season);

        // Repoint league settings to the new season.
        LeagueSettings settings = leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID).orElse(null);
        if (settings != null) {
            settings.setSeasonId(code);
            settings.setSeasonName(saved.getName());
            leagueSettingsRepository.save(settings);
        }

        // Carry franchises into the new season with reset standings (points are season-scoped).
        List<Franchise> franchises = franchiseRepository.findAll();
        for (Franchise f : franchises) {
            f.setSeasonId(code);
            f.setPoints(0);
            f.setRank(0);
        }
        franchiseRepository.saveAll(franchises);

        auditService.record("season.start", "Season", saved.getCode(), "Started " + saved.getName());
        return toView(saved, saved);
    }

    // ---- helpers ----

    private Season activeOrNull() {
        return seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE).orElse(null);
    }

    /** Recompute and persist a frozen standings snapshot for the given season code. */
    private void snapshot(String code) {
        seasonStandingRepository.deleteBySeasonCode(code);
        List<SeasonStandingView> live = liveStandings(code);
        List<SeasonStanding> rows = live.stream().map(v -> {
            SeasonStanding s = new SeasonStanding();
            s.setSeasonCode(code);
            s.setFranchiseId(v.franchiseId());
            s.setFranchiseName(v.name());
            s.setFranchiseTag(v.tag());
            s.setPoints(v.points());
            s.setRank(v.rank());
            return s;
        }).toList();
        seasonStandingRepository.saveAll(rows);
    }

    /** Live standings for a season: franchises belonging to it, ranked by points desc then name. */
    private List<SeasonStandingView> liveStandings(String code) {
        List<Franchise> franchises = franchiseRepository.findAll().stream()
                .filter(f -> code.equals(f.getSeasonId()))
                .sorted(Comparator.comparingInt(Franchise::getPoints).reversed()
                        .thenComparing(Franchise::getName, Comparator.nullsLast(String::compareTo)))
                .toList();
        int rank = 1;
        List<SeasonStandingView> rows = new java.util.ArrayList<>(franchises.size());
        for (Franchise f : franchises) {
            rows.add(new SeasonStandingView(rank++, f.getId().toString(), f.getName(),
                    f.getTag(), f.getPoints()));
        }
        return rows;
    }

    private static SeasonView toView(Season s, Season active) {
        boolean current = active != null && active.getId().equals(s.getId());
        return new SeasonView(s.getCode(), s.getName(), s.getStatus().name(), current,
                s.getStartedAt(), s.getEndedAt());
    }
}
