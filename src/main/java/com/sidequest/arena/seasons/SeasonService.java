package com.sidequest.arena.seasons;

import com.sidequest.arena.announcements.AnnouncementService;
import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerFranchiseHistory;
import com.sidequest.arena.model.Season;
import com.sidequest.arena.model.SeasonStanding;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.PlayerFranchiseHistoryRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.SeasonRepository;
import com.sidequest.arena.repo.SeasonStandingRepository;
import com.sidequest.arena.seasons.dto.SeasonStandingView;
import com.sidequest.arena.seasons.dto.SeasonView;
import com.sidequest.arena.seasons.dto.StartSeasonRequest;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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
    private final PlayerRepository playerRepository;
    private final PlayerFranchiseHistoryRepository playerFranchiseHistoryRepository;
    private final LeagueSettingsRepository leagueSettingsRepository;
    private final AnnouncementService announcementService;
    private final AuditService auditService;

    public SeasonService(SeasonRepository seasonRepository,
                         SeasonStandingRepository seasonStandingRepository,
                         FranchiseRepository franchiseRepository,
                         PlayerRepository playerRepository,
                         PlayerFranchiseHistoryRepository playerFranchiseHistoryRepository,
                         LeagueSettingsRepository leagueSettingsRepository,
                         AnnouncementService announcementService,
                         AuditService auditService) {
        this.seasonRepository = seasonRepository;
        this.seasonStandingRepository = seasonStandingRepository;
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.playerFranchiseHistoryRepository = playerFranchiseHistoryRepository;
        this.leagueSettingsRepository = leagueSettingsRepository;
        this.announcementService = announcementService;
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
     * Combined all-time standings across every season: the sum of each franchise's frozen
     * {@link SeasonStanding} points from all finished seasons, plus the current live points of any
     * franchise still competing. Franchises are keyed by id (or by tag for legacy rows with no id).
     * Name/tag come from the most recent record for that franchise. Ranked 1..n by total points desc.
     * (The conceptual season code for this view is "ALL"; {@link SeasonStandingView} carries no code.)
     */
    @Transactional(readOnly = true)
    public List<SeasonStandingView> allTimeStandings() {
        Map<String, AllTimeAcc> byKey = new HashMap<>();

        // Frozen history from every finished season.
        for (SeasonStanding s : seasonStandingRepository.findAll()) {
            String key = s.getFranchiseId() != null ? s.getFranchiseId() : "tag:" + s.getFranchiseTag();
            AllTimeAcc acc = byKey.computeIfAbsent(key, k -> new AllTimeAcc());
            acc.points += s.getPoints();
            Instant stamp = s.getCreatedAt() != null ? s.getCreatedAt() : Instant.EPOCH;
            if (acc.nameStamp == null || stamp.isAfter(acc.nameStamp)) {
                acc.nameStamp = stamp;
                acc.franchiseId = s.getFranchiseId();
                acc.name = s.getFranchiseName();
                acc.tag = s.getFranchiseTag();
            }
        }

        // Live points from the current season's franchises — only while a season is ACTIVE. In the
        // off-season (finished but no new season started) the just-finished season already has a frozen
        // snapshot AND the franchises still carry those same points, so adding live points would double
        // count. We still refresh each franchise's name/tag from the live row (freshest) either way.
        boolean seasonActive = activeOrNull() != null;
        for (Franchise f : franchiseRepository.findAll()) {
            // A discarded franchise still shows through its frozen SeasonStanding snapshots for seasons it
            // actually competed in, but is not re-injected as a live row in the all-time table.
            if (!f.isActive()) {
                continue;
            }
            String key = f.getId().toString();
            AllTimeAcc acc = byKey.computeIfAbsent(key, k -> new AllTimeAcc());
            if (seasonActive) {
                acc.points += f.getPoints();
            }
            acc.nameStamp = Instant.MAX;
            acc.franchiseId = f.getId().toString();
            acc.name = f.getName();
            acc.tag = f.getTag();
        }

        List<AllTimeAcc> sorted = byKey.values().stream()
                .sorted(Comparator.comparingLong((AllTimeAcc a) -> a.points).reversed()
                        .thenComparing(a -> a.name == null ? "" : a.name))
                .toList();

        List<SeasonStandingView> rows = new ArrayList<>(sorted.size());
        int rank = 1;
        for (AllTimeAcc a : sorted) {
            rows.add(new SeasonStandingView(rank++, a.franchiseId, a.name, a.tag, (int) a.points));
        }
        return rows;
    }

    /** Mutable accumulator for {@link #allTimeStandings()}: running total plus latest name/tag. */
    private static final class AllTimeAcc {
        long points;
        String franchiseId;
        String name;
        String tag;
        Instant nameStamp;
    }

    /**
     * Admin: finish the active season — snapshot its franchises' final standings and mark it FINISHED.
     * Idempotent per season (re-snapshots). 409 if there is no active season.
     */
    @CacheEvict(cacheNames = {CacheConfig.STANDINGS, CacheConfig.FRANCHISES, CacheConfig.PLAYERS,
            CacheConfig.LEADERBOARD_PLAYERS}, allEntries = true)
    @Transactional
    public SeasonView finish() {
        Season active = seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE)
                .orElseThrow(() -> ApiException.conflict("No active season to finish"));
        snapshot(active.getCode());
        archiveAndResetRosters(active.getCode());
        active.setStatus(SeasonStatus.FINISHED);
        active.setEndedAt(Instant.now());
        Season saved = seasonRepository.save(active);
        auditService.record("season.finish", "Season", saved.getCode(),
                "Finished " + saved.getName());
        return toView(saved, null);
    }

    /**
     * Admin: start a new season. The current season must be finished first — this deliberately does
     * NOT silently end a running season, so the intended off-season workflow (finish → keep/discard
     * franchises → auction → rosters set → start) is preserved. The new season becomes current, league
     * settings are repointed to it, and every franchise is carried forward with points/rank reset to
     * zero (season-scoped points). 409 if a season is still running, or the code already exists.
     */
    @CacheEvict(cacheNames = {CacheConfig.STANDINGS, CacheConfig.FRANCHISES, CacheConfig.PLAYERS,
            CacheConfig.LEADERBOARD_PLAYERS}, allEntries = true)
    @Transactional
    public SeasonView start(StartSeasonRequest req) {
        String code = req.code().trim();
        if (activeOrNull() != null) {
            throw ApiException.conflict(
                    "Finish the current season before starting a new one");
        }
        if (seasonRepository.existsByCodeIgnoreCase(code)) {
            throw ApiException.conflict("A season with code '" + code + "' already exists");
        }

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

        // Franchise creation is an off-season activity — starting a season closes any open franchise
        // calls and voids still-pending proposals so they can't linger into the live season.
        announcementService.closeFranchiseCalls();

        auditService.record("season.start", "Season", saved.getCode(), "Started " + saved.getName());
        return toView(saved, saved);
    }

    // ---- helpers ----

    private Season activeOrNull() {
        return seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE).orElse(null);
    }

    /**
     * Archive every franchise's current roster into {@link PlayerFranchiseHistory} for the given
     * season (tagging each player OWNER / MANAGER / PLAYER), then reset the playing rosters for the
     * next season's auction: the regular players are detached from their franchise, while the
     * franchise LEADERSHIP (owner / manager) PERSISTS across seasons and stays on the roster. Leaders
     * change only between seasons via the owner/manager invite flow, not on the reset. The prior
     * season's full memberships remain browsable in history.
     */
    private void archiveAndResetRosters(String seasonCode) {
        List<Franchise> franchises = franchiseRepository.findAll();

        // Leaders (owner / manager of any franchise) are protected — they carry over unchanged.
        Set<UUID> protectedLeaders = new HashSet<>();
        for (Franchise f : franchises) {
            if (f.getOwnerPlayer() != null) protectedLeaders.add(f.getOwnerPlayer().getId());
            if (f.getManagerPlayer() != null) protectedLeaders.add(f.getManagerPlayer().getId());
        }

        // (a) One history row per roster player, tagged with the role they held.
        List<PlayerFranchiseHistory> history = new ArrayList<>();
        for (Franchise f : franchises) {
            Player owner = f.getOwnerPlayer();
            Player manager = f.getManagerPlayer();
            UUID ownerId = owner != null ? owner.getId() : null;
            UUID managerId = manager != null ? manager.getId() : null;
            for (Player p : playerRepository.findByFranchiseId(f.getId())) {
                String role;
                if (ownerId != null && ownerId.equals(p.getId())) {
                    role = "OWNER";
                } else if (managerId != null && managerId.equals(p.getId())) {
                    role = "MANAGER";
                } else {
                    role = "PLAYER";
                }
                PlayerFranchiseHistory row = new PlayerFranchiseHistory();
                row.setPlayerId(p.getId());
                row.setPlayerGamerTag(p.getGamerTag());
                row.setFranchiseId(f.getId());
                row.setFranchiseName(f.getName());
                row.setFranchiseTag(f.getTag());
                row.setSeasonCode(seasonCode);
                row.setRole(role);
                row.setRecordedAt(Instant.now());
                history.add(row);
            }
        }
        playerFranchiseHistoryRepository.saveAll(history);

        // (b) Detach only the regular players; leaders (owner / manager / IGL) stay on their franchise.
        List<Player> detached = new ArrayList<>();
        for (Player p : playerRepository.findAll()) {
            if (p.getFranchise() != null && !protectedLeaders.contains(p.getId())) {
                p.setFranchise(null);
                detached.add(p);
            }
        }
        playerRepository.saveAll(detached);
        // Leadership slots are intentionally NOT cleared — owner/manager/IGL persist across seasons.
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
