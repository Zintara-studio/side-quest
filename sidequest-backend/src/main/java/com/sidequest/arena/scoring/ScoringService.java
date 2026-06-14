package com.sidequest.arena.scoring;

import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.realtime.RealtimeService;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final RealtimeService realtime;

    public ScoringService(FranchiseRepository franchiseRepo,
                          PlayerRepository playerRepo,
                          ResultRowRepository resultRowRepo,
                          RealtimeService realtime) {
        this.franchiseRepo = franchiseRepo;
        this.playerRepo = playerRepo;
        this.resultRowRepo = resultRowRepo;
        this.realtime = realtime;
    }

    /**
     * Triggered after an admin publishes results for a match. Emits the per-match result table, then
     * recomputes and broadcasts the league standings.
     */
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
     * Full recompute: franchise points = sum of its result-row totals; players inherit their
     * franchise's standing; ranks are assigned by points (desc). Idempotent.
     */
    @Transactional
    public void recomputeStandings() {
        List<ResultRow> allRows = resultRowRepo.findAll();
        Map<UUID, Integer> pointsByFranchise = allRows.stream()
                .filter(r -> r.getFranchise() != null)
                .collect(Collectors.groupingBy(r -> r.getFranchise().getId(),
                        Collectors.summingInt(ResultRow::getTotal)));

        List<Franchise> franchises = franchiseRepo.findAll();
        for (Franchise f : franchises) {
            f.setPoints(pointsByFranchise.getOrDefault(f.getId(), 0));
        }
        // Rank by points desc, then name for stable ordering.
        franchises.sort(Comparator.comparingInt(Franchise::getPoints).reversed()
                .thenComparing(Franchise::getName, Comparator.nullsLast(String::compareTo)));
        int rank = 1;
        for (Franchise f : franchises) {
            f.setRank(rank++);
        }
        franchiseRepo.saveAll(franchises);

        // Players inherit their franchise's points (team standing drives the player leaderboard).
        Map<UUID, Integer> franchisePoints = franchises.stream()
                .collect(Collectors.toMap(Franchise::getId, Franchise::getPoints));
        List<Player> players = playerRepo.findAll();
        for (Player p : players) {
            int pts = p.getFranchise() != null
                    ? franchisePoints.getOrDefault(p.getFranchise().getId(), 0) : 0;
            p.setPoints(pts);
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
        m.put("franchiseId", r.getFranchise().getId().toString());
        m.put("kills", r.getKills());
        m.put("placePts", r.getPlacePts());
        m.put("total", r.getTotal());
        m.put("rank", r.getRank());
        return m;
    }
}
