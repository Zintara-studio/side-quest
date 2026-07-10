package com.sidequest.arena.scoring;

import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.Season;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.realtime.RealtimeService;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.MatchRoundPlayerResultRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.SeasonRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.sidequest.arena.config.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The scoring engine. On result publish it performs a full, idempotent recompute of franchise
 * points, player points and standings ranks, then emits live updates to the realtime hub. Because
 * it recomputes from the complete set of {@link ResultRow}s every time, re-running it (e.g. after a
 * dispute correction) always converges to the same state.
 */
@Service
public class ScoringService {

    private static final Logger log = LoggerFactory.getLogger(ScoringService.class);

    private final FranchiseRepository franchiseRepo;
    private final PlayerRepository playerRepo;
    private final ResultRowRepository resultRowRepo;
    private final MatchRoundPlayerResultRepository playerResultRepo;
    private final SeasonRepository seasonRepo;
    private final RealtimeService realtime;

    public ScoringService(FranchiseRepository franchiseRepo,
                          PlayerRepository playerRepo,
                          ResultRowRepository resultRowRepo,
                          MatchRoundPlayerResultRepository playerResultRepo,
                          SeasonRepository seasonRepo,
                          RealtimeService realtime) {
        this.franchiseRepo = franchiseRepo;
        this.playerRepo = playerRepo;
        this.resultRowRepo = resultRowRepo;
        this.playerResultRepo = playerResultRepo;
        this.seasonRepo = seasonRepo;
        this.realtime = realtime;
    }

    /**
     * Triggered after an admin publishes results for a match. Emits the per-match result table, then
     * recomputes and broadcasts the league standings.
     */
    @CacheEvict(cacheNames = {CacheConfig.STANDINGS, CacheConfig.LEADERBOARD_PLAYERS,
            CacheConfig.GAME_RANKINGS, CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public void onResultsPublished(Match match) {
        List<ResultRow> rows = resultRowRepo.findByMatchIdOrderByRankAsc(match.getId());
        realtime.publishMatchUpdate(match.getId(), Map.of(
                "matchId", match.getId().toString(),
                "status", match.getStatus().name(),
                "results", rows.stream().map(ScoringService::resultView).toList()));
        recomputeStandings();
        log.info("Scoring engine recomputed standings after publishing results for match {}", match.getId());
    }

    /**
     * Full recompute: franchise points = sum of its result-row totals from matches in the <em>active</em>
     * season (season-scoped, so a new season starts from a clean slate); ranks by points desc. Player
     * points, by contrast, are a season-independent CAREER total aggregated from the player's own
     * performance across every match/season, so they accumulate and never reset. Idempotent — recomputes
     * from the retained result history every time.
     *
     * <p>The franchise table is only recomputed while a season is ACTIVE. Off-season (a finished season
     * with no successor started yet) the live franchise points still reflect the just-finished season, so
     * a later scoring-weight edit or a match void must NOT retroactively re-weight them — the block is
     * skipped and the finished season's standings stay frozen. Player career points are recomputed
     * unconditionally, since they are not season-scoped.
     */
    @CacheEvict(cacheNames = {CacheConfig.STANDINGS, CacheConfig.LEADERBOARD_PLAYERS,
            CacheConfig.GAME_RANKINGS, CacheConfig.FRANCHISES, CacheConfig.PLAYERS}, allEntries = true)
    @Transactional
    public void recomputeStandings() {
        List<Franchise> franchises = franchiseRepo.findAll();

        String activeSeason = seasonRepo.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE)
                .map(Season::getCode).orElse(null);
        if (activeSeason != null) {
            // One aggregate query returns each franchise's un-rounded, per-game-weighted total for the
            // ACTIVE season (excluding cancelled fixtures) — instead of materializing every ResultRow
            // ever and lazy-loading its match per row. Rounding happens ONCE per franchise below (never
            // per row — that would drift for fractional weights like a 0.75× title), and the arithmetic
            // stays in double/long so an extreme total × weight can never wrap the int; the write
            // saturates into the column's range.
            Map<UUID, Double> pointsByFranchise = new HashMap<>();
            for (Object[] row : resultRowRepo.aggregateFranchisePoints(activeSeason)) {
                if (row[0] != null && row[1] != null) {
                    pointsByFranchise.merge((UUID) row[0], ((Number) row[1]).doubleValue(), Double::sum);
                }
            }

            for (Franchise f : franchises) {
                long rounded = Math.round(pointsByFranchise.getOrDefault(f.getId(), 0.0));
                f.setPoints((int) Math.max(0, Math.min(Integer.MAX_VALUE, rounded)));
            }
            // Rank by points desc, then name for stable ordering.
            franchises.sort(Comparator.comparingInt(Franchise::getPoints).reversed()
                    .thenComparing(Franchise::getName, Comparator.nullsLast(String::compareTo)));
            int rank = 1;
            for (Franchise f : franchises) {
                f.setRank(rank++);
            }
            franchiseRepo.saveAll(franchises);
        }

        // Players are NOT seasonal — their points are a CAREER total that accumulates across all
        // seasons and survives franchise resets. It is the sum of: (a) their individual kills in
        // FRANCHISE matches, weighted by each match's pointsPerKill (aggregatePlayerKillPoints is
        // restricted to franchise-match rows), and (b) their FFA result totals (kills×ppk + placement,
        // from the player-owned ResultRow rows). The franchise!=null guard on (a) keeps the two sources
        // disjoint even when an FFA row was entered with a per-player breakdown, so no double counting.
        Map<UUID, Long> careerPoints = new HashMap<>();
        for (Object[] row : playerResultRepo.aggregatePlayerKillPoints()) {
            if (row[0] != null) {
                careerPoints.merge((UUID) row[0], ((Number) row[1]).longValue(), Long::sum);
            }
        }
        for (Object[] row : resultRowRepo.aggregateFfaPlayerPoints()) {
            if (row[0] != null) {
                careerPoints.merge((UUID) row[0], ((Number) row[1]).longValue(), Long::sum);
            }
        }
        List<Player> players = playerRepo.findAll();
        for (Player p : players) {
            p.setPoints(careerPoints.getOrDefault(p.getId(), 0L).intValue());
        }
        playerRepo.saveAll(players);

        realtime.publishStandings(standingsSnapshot(franchises));
    }

    private static Map<String, Object> standingsSnapshot(List<Franchise> ranked) {
        return Map.of("standings", ranked.stream().map(f -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("franchiseId", f.getId().toString());
            m.put("name", f.getName());
            m.put("tag", f.getTag());
            m.put("points", f.getPoints());
            m.put("rank", f.getRank());
            return m;
        }).toList());
    }

    private static Map<String, Object> resultView(ResultRow r) {
        Map<String, Object> m = new LinkedHashMap<>();
        // FRANCHISE rows carry a franchise; FFA rows carry an individual player instead.
        var franchise = r.getFranchise();
        var player = r.getPlayer();
        m.put("franchiseId", franchise != null ? franchise.getId().toString() : null);
        m.put("playerId", player != null ? player.getId().toString() : null);
        m.put("name", franchise != null ? franchise.getName()
                : (player != null ? player.getGamerTag() : null));
        m.put("kills", r.getKills());
        m.put("placePts", r.getPlacePts());
        m.put("total", r.getTotal());
        m.put("rank", r.getRank());
        return m;
    }
}
