package com.sidequest.arena.matches;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.matches.dto.CreateMatchRequest;
import com.sidequest.arena.matches.dto.EnterResultsRequest;
import com.sidequest.arena.matches.dto.GameMini;
import com.sidequest.arena.matches.dto.MatchDetail;
import com.sidequest.arena.matches.dto.MatchSummary;
import com.sidequest.arena.matches.dto.ParticipantView;
import com.sidequest.arena.matches.dto.ResultEntry;
import com.sidequest.arena.matches.dto.ResultView;
import com.sidequest.arena.matches.dto.UpdateMatchRequest;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.scoring.ScoringService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Matches domain: fixture listing/detail, per-match leaderboards, and the admin flows that schedule
 * fixtures, patch them, and enter/publish results. Publishing results drives the scoring engine,
 * which recomputes league standings and emits realtime updates.
 */
@Service
public class MatchService {

    private final MatchRepository matchRepository;
    private final GameRepository gameRepository;
    private final FranchiseRepository franchiseRepository;
    private final MatchParticipantRepository matchParticipantRepository;
    private final ResultRowRepository resultRowRepository;
    private final ScoringService scoringService;
    private final AuditService auditService;

    public MatchService(MatchRepository matchRepository,
                        GameRepository gameRepository,
                        FranchiseRepository franchiseRepository,
                        MatchParticipantRepository matchParticipantRepository,
                        ResultRowRepository resultRowRepository,
                        ScoringService scoringService,
                        AuditService auditService) {
        this.matchRepository = matchRepository;
        this.gameRepository = gameRepository;
        this.franchiseRepository = franchiseRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.scoringService = scoringService;
        this.auditService = auditService;
    }

    /**
     * Lists fixtures (newest first), optionally filtered by status and/or game, then paginated.
     * Picks the repository finder matching the supplied filter combination.
     */
    @Transactional(readOnly = true)
    public PageResponse<MatchSummary> list(MatchStatus status, UUID gameId, Integer limit, String cursor) {
        List<Match> matches;
        if (status != null && gameId != null) {
            matches = matchRepository.findByStatusAndGameIdOrderByScheduledAtDesc(status, gameId);
        } else if (status != null) {
            matches = matchRepository.findByStatusOrderByScheduledAtDesc(status);
        } else if (gameId != null) {
            matches = matchRepository.findByGameIdOrderByScheduledAtDesc(gameId);
        } else {
            matches = matchRepository.findAllByOrderByScheduledAtDesc();
        }
        List<MatchSummary> summaries = matches.stream().map(this::toSummary).toList();
        return Cursors.paginate(summaries, cursor, limit);
    }

    /** Returns a fixture with its rosters and whether results have been published. 404 if missing. */
    @Transactional(readOnly = true)
    public MatchDetail get(String id) {
        Match match = require(id);
        return toDetail(match);
    }

    /** Returns the published result table for a match, ordered by rank (best first). 404 if missing. */
    @Transactional(readOnly = true)
    public List<ResultView> leaderboard(String id) {
        Match match = require(id);
        return resultRowRepository.findByMatchIdOrderByRankAsc(match.getId()).stream()
                .map(MatchService::toResultView)
                .toList();
    }

    /**
     * Admin: schedules a new fixture in {@code SCHEDULED} status and seeds its roster from the
     * supplied franchise ids. 404 if the game or any franchise is missing. Returns the new detail.
     */
    @Transactional
    public MatchDetail create(CreateMatchRequest request) {
        Game game = gameRepository.findById(parseId(request.gameId(), "Game"))
                .orElseThrow(() -> ApiException.notFound("Game", request.gameId()));

        Match match = new Match();
        match.setGame(game);
        match.setScheduledAt(request.scheduledAt());
        match.setStatus(MatchStatus.SCHEDULED);
        match.setArena(request.arena());
        match.setFormat(request.format());
        match.setSeasonId(request.seasonId());
        Match saved = matchRepository.save(match);

        if (request.participantFranchiseIds() != null) {
            for (String franchiseId : request.participantFranchiseIds()) {
                Franchise franchise = requireFranchise(franchiseId);
                MatchParticipant participant = new MatchParticipant();
                participant.setMatch(saved);
                participant.setFranchise(franchise);
                matchParticipantRepository.save(participant);
            }
        }

        auditService.record("match.create", "Match", saved.getId().toString(), game.getName());
        return toDetail(saved);
    }

    /** Admin: applies the non-null fields of the request to the fixture, saves and audits. 404 if missing. */
    @Transactional
    public MatchDetail update(String id, UpdateMatchRequest request) {
        Match match = require(id);

        List<String> changes = new ArrayList<>();
        if (request.scheduledAt() != null) {
            match.setScheduledAt(request.scheduledAt());
            changes.add("scheduledAt=" + request.scheduledAt());
        }
        if (request.status() != null) {
            match.setStatus(request.status());
            changes.add("status=" + request.status());
        }
        if (request.arena() != null) {
            match.setArena(request.arena());
            changes.add("arena=" + request.arena());
        }
        if (request.format() != null) {
            match.setFormat(request.format());
            changes.add("format=" + request.format());
        }

        Match saved = matchRepository.save(match);

        String summary = changes.isEmpty() ? "no changes" : String.join(", ", changes);
        auditService.record("match.update", "Match", saved.getId().toString(), summary);
        return toDetail(saved);
    }

    /**
     * Admin: enters (or re-publishes) the result table for a match. Existing rows are cleared first,
     * so the operation is idempotent / safe to re-run after corrections. Rows are ranked by total
     * (desc), the match is marked {@code COMPLETED}, the scoring engine recomputes standings, and the
     * published leaderboard is returned. 404 if the match or any franchise is missing.
     */
    @Transactional
    public List<ResultView> enterResults(String id, EnterResultsRequest request) {
        Match match = require(id);

        // Clear any previously published rows so re-publishing converges to the new state.
        resultRowRepository.deleteByMatchId(match.getId());
        resultRowRepository.flush();

        // Build the new rows, ranking by total (desc).
        List<ResultRow> rows = new ArrayList<>();
        for (ResultEntry entry : request.rows()) {
            Franchise franchise = requireFranchise(entry.franchiseId());
            ResultRow row = new ResultRow();
            row.setMatch(match);
            row.setFranchise(franchise);
            row.setKills(entry.kills());
            row.setPlacePts(entry.placePts());
            row.setTotal(entry.kills() + entry.placePts());
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt(ResultRow::getTotal).reversed());
        int rank = 1;
        for (ResultRow row : rows) {
            row.setRank(rank++);
        }
        resultRowRepository.saveAll(rows);

        match.setStatus(MatchStatus.COMPLETED);
        match.setResultsPublishedAt(Instant.now());
        matchRepository.save(match);

        // Recompute standings and emit realtime updates.
        scoringService.onResultsPublished(match);

        auditService.record("match.results.publish", "Match", match.getId().toString(),
                request.rows().size() + " rows");

        return resultRowRepository.findByMatchIdOrderByRankAsc(match.getId()).stream()
                .map(MatchService::toResultView)
                .toList();
    }

    // ---- loaders ----

    /** Load a match by its string id, or throw 404 (an unparseable id can never match). */
    private Match require(String id) {
        return matchRepository.findById(parseId(id, "Match"))
                .orElseThrow(() -> ApiException.notFound("Match", id));
    }

    /** Load a franchise by its string id, or throw 404 (an unparseable id can never match). */
    private Franchise requireFranchise(String id) {
        return franchiseRepository.findById(parseId(id, "Franchise"))
                .orElseThrow(() -> ApiException.notFound("Franchise", id));
    }

    private static UUID parseId(String id, String resource) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound(resource, id);
        }
    }

    // ---- mappers ----

    private MatchSummary toSummary(Match match) {
        List<String> participantTags = matchParticipantRepository.findByMatchId(match.getId()).stream()
                .map(MatchParticipant::getFranchise)
                .filter(f -> f != null)
                .map(Franchise::getTag)
                .toList();
        return new MatchSummary(
                match.getId().toString(),
                toGameMini(match.getGame()),
                match.getScheduledAt(),
                match.getStatus() == null ? null : match.getStatus().name(),
                match.getArena(),
                match.getFormat(),
                match.getSeasonId(),
                participantTags
        );
    }

    private MatchDetail toDetail(Match match) {
        List<ParticipantView> participants = matchParticipantRepository.findByMatchId(match.getId()).stream()
                .map(MatchParticipant::getFranchise)
                .filter(f -> f != null)
                .map(f -> new ParticipantView(f.getId().toString(), f.getName(), f.getTag()))
                .toList();
        boolean hasResults = resultRowRepository.existsByMatchId(match.getId());
        return new MatchDetail(
                match.getId().toString(),
                toGameMini(match.getGame()),
                match.getScheduledAt(),
                match.getStatus() == null ? null : match.getStatus().name(),
                match.getArena(),
                match.getFormat(),
                match.getSeasonId(),
                hasResults,
                participants
        );
    }

    private static GameMini toGameMini(Game game) {
        if (game == null) {
            return null;
        }
        return new GameMini(game.getId().toString(), game.getName());
    }

    private static ResultView toResultView(ResultRow row) {
        Franchise franchise = row.getFranchise();
        return new ResultView(
                row.getRank(),
                franchise == null ? null : franchise.getId().toString(),
                franchise == null ? null : franchise.getName(),
                franchise == null ? null : franchise.getTag(),
                row.getKills(),
                row.getPlacePts(),
                row.getTotal()
        );
    }
}
