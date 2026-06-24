package com.sidequest.arena.matches;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.matches.dto.CreateMatchRequest;
import com.sidequest.arena.matches.dto.EnterResultsRequest;
import com.sidequest.arena.matches.dto.EnterRoundsRequest;
import com.sidequest.arena.matches.dto.GameMini;
import com.sidequest.arena.matches.dto.MatchPlayerView;
import com.sidequest.arena.matches.dto.MatchRoundView;
import com.sidequest.arena.matches.dto.MatchDetail;
import com.sidequest.arena.matches.dto.MatchSummary;
import com.sidequest.arena.matches.dto.ParticipantView;
import com.sidequest.arena.matches.dto.ResultEntry;
import com.sidequest.arena.matches.dto.ResultView;
import com.sidequest.arena.matches.dto.UpdateMatchRequest;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.MatchRound;
import com.sidequest.arena.model.MatchRoundPlayerResult;
import com.sidequest.arena.model.MatchRoundResult;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.MatchType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.TeamInvite;
import com.sidequest.arena.model.InviteStatus;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.MatchRoundPlayerResultRepository;
import com.sidequest.arena.repo.MatchRoundRepository;
import com.sidequest.arena.repo.MatchRoundResultRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.TeamInviteRepository;
import com.sidequest.arena.scoring.ScoringService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final PlayerRepository playerRepository;
    private final MatchParticipantRepository matchParticipantRepository;
    private final ResultRowRepository resultRowRepository;
    private final MatchRoundRepository matchRoundRepository;
    private final MatchRoundResultRepository matchRoundResultRepository;
    private final MatchRoundPlayerResultRepository matchRoundPlayerResultRepository;
    private final LeagueSettingsRepository leagueSettingsRepository;
    private final RegistrationRepository registrationRepository;
    private final TeamInviteRepository teamInviteRepository;
    private final ScoringService scoringService;
    private final AuditService auditService;

    public MatchService(MatchRepository matchRepository,
                        GameRepository gameRepository,
                        FranchiseRepository franchiseRepository,
                        PlayerRepository playerRepository,
                        MatchParticipantRepository matchParticipantRepository,
                        ResultRowRepository resultRowRepository,
                        MatchRoundRepository matchRoundRepository,
                        MatchRoundResultRepository matchRoundResultRepository,
                        MatchRoundPlayerResultRepository matchRoundPlayerResultRepository,
                        LeagueSettingsRepository leagueSettingsRepository,
                        RegistrationRepository registrationRepository,
                        TeamInviteRepository teamInviteRepository,
                        ScoringService scoringService,
                        AuditService auditService) {
        this.matchRepository = matchRepository;
        this.gameRepository = gameRepository;
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.matchRoundRepository = matchRoundRepository;
        this.matchRoundResultRepository = matchRoundResultRepository;
        this.matchRoundPlayerResultRepository = matchRoundPlayerResultRepository;
        this.leagueSettingsRepository = leagueSettingsRepository;
        this.registrationRepository = registrationRepository;
        this.teamInviteRepository = teamInviteRepository;
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
        match.setMatchType(request.matchType() != null ? request.matchType() : MatchType.FRANCHISE);
        match.setArena(request.arena());
        match.setFormat(request.format());
        match.setSeasonId(request.seasonId());
        // Seed scoring weights from the current league defaults; adjustable per match at result entry.
        LeagueSettings defaults = leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID).orElse(null);
        if (defaults != null) {
            match.setPointsPerKill(defaults.getPointsPerKill());
            match.setPlacementPoints(defaults.getPlacementPoints());
        }
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

        // Build the new rows, ranking by total (desc). Kills are weighted by the match's pointsPerKill
        // so the convention matches the per-round path: kills = raw count, total = kills×ppk + placePts.
        int pointsPerKill = match.getPointsPerKill();
        List<ResultRow> rows = new ArrayList<>();
        for (ResultEntry entry : request.rows()) {
            Franchise franchise = requireFranchise(entry.franchiseId());
            ResultRow row = new ResultRow();
            row.setMatch(match);
            row.setFranchise(franchise);
            row.setKills(entry.kills());
            row.setPlacePts(entry.placePts());
            row.setTotal(entry.kills() * pointsPerKill + entry.placePts());
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

    /**
     * Admin: enters (or re-publishes) per-round results for a match. Existing rounds / round-results /
     * per-player rows / result-rows are cleared first, so this is idempotent and safe to re-run when an
     * admin edits a previously completed match.
     *
     * <p>Scoring is weight-driven: each round's placement points are derived from the entered rank and
     * the match's {@code placementPoints} ladder, and a franchise's overall total is
     * {@code (sum of kills) × pointsPerKill + (sum of placement points)}. Weights supplied on the request
     * override (and are persisted onto) the match; otherwise the match's existing weights are kept. When a
     * franchise's round line carries a per-player breakdown, its round kills are the sum of those players'
     * kills (and survival is the longest among them). Returns the aggregated leaderboard. 404 if the match
     * or any franchise is missing.
     */
    @Transactional
    public List<ResultView> enterRounds(String id, EnterRoundsRequest request) {
        Match match = require(id);

        // Apply (and persist) the scoring weights for this fixture.
        if (request.pointsPerKill() != null) {
            match.setPointsPerKill(request.pointsPerKill());
        }
        if (request.placementPoints() != null && !request.placementPoints().isBlank()) {
            match.setPlacementPoints(request.placementPoints());
        }
        int pointsPerKill = match.getPointsPerKill();
        int[] placementLadder = parsePlacementPoints(match.getPlacementPoints());

        // Clear prior rounds + their results + per-player rows + aggregated result rows so re-entry converges.
        matchRoundPlayerResultRepository.deleteByMatchId(match.getId());
        matchRoundResultRepository.deleteByMatchId(match.getId());
        matchRoundRepository.deleteByMatchId(match.getId());
        resultRowRepository.deleteByMatchId(match.getId());
        matchRoundPlayerResultRepository.flush();
        matchRoundResultRepository.flush();
        matchRoundRepository.flush();
        resultRowRepository.flush();

        Map<UUID, int[]> aggregate = new HashMap<>(); // franchiseId -> [kills, placePts]
        Map<UUID, Franchise> franchises = new HashMap<>();

        for (EnterRoundsRequest.RoundEntry roundEntry : request.rounds()) {
            MatchRound round = new MatchRound();
            round.setMatch(match);
            round.setRoundNumber(roundEntry.roundNumber());
            round.setMapName(roundEntry.mapName());
            round.setMode(roundEntry.mode());
            MatchRound savedRound = matchRoundRepository.save(round);

            for (EnterRoundsRequest.RoundResultEntry row : roundEntry.rows()) {
                Franchise franchise = requireFranchise(row.franchiseId());
                franchises.put(franchise.getId(), franchise);

                boolean hasPlayers = row.players() != null && !row.players().isEmpty();
                int teamKills = row.kills();
                int teamSurvival = row.survivalSeconds();
                if (hasPlayers) {
                    teamKills = row.players().stream().mapToInt(EnterRoundsRequest.PlayerStatEntry::kills).sum();
                    teamSurvival = row.players().stream()
                            .mapToInt(EnterRoundsRequest.PlayerStatEntry::survivalSeconds).max().orElse(0);
                }
                int placePts = placementForRank(placementLadder, row.rank());

                MatchRoundResult result = new MatchRoundResult();
                result.setMatchRound(savedRound);
                result.setFranchise(franchise);
                result.setRank(row.rank());
                result.setKills(teamKills);
                result.setSurvivalSeconds(teamSurvival);
                result.setPlacePts(placePts);
                matchRoundResultRepository.save(result);

                if (hasPlayers) {
                    for (EnterRoundsRequest.PlayerStatEntry pe : row.players()) {
                        Player player = requirePlayer(pe.playerId());
                        MatchRoundPlayerResult pr = new MatchRoundPlayerResult();
                        pr.setMatchRound(savedRound);
                        pr.setFranchise(franchise);
                        pr.setPlayer(player);
                        pr.setKills(pe.kills());
                        pr.setSurvivalSeconds(pe.survivalSeconds());
                        matchRoundPlayerResultRepository.save(pr);
                    }
                }

                int[] totals = aggregate.computeIfAbsent(franchise.getId(), k -> new int[2]);
                totals[0] += teamKills;
                totals[1] += placePts;
            }
        }

        // Aggregate rounds into overall result rows: total = kills × pointsPerKill + placement points.
        List<ResultRow> rows = new ArrayList<>();
        for (Map.Entry<UUID, int[]> entry : aggregate.entrySet()) {
            int kills = entry.getValue()[0];
            int placePts = entry.getValue()[1];
            ResultRow row = new ResultRow();
            row.setMatch(match);
            row.setFranchise(franchises.get(entry.getKey()));
            row.setKills(kills);
            row.setPlacePts(placePts);
            row.setTotal(kills * pointsPerKill + placePts);
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

        scoringService.onResultsPublished(match);
        auditService.record("match.rounds.publish", "Match", match.getId().toString(),
                "Published " + request.rounds().size() + " round(s) for "
                        + (match.getGame() != null ? match.getGame().getName() : "match"));

        return resultRowRepository.findByMatchIdOrderByRankAsc(match.getId()).stream()
                .map(MatchService::toResultView)
                .toList();
    }

    /**
     * Parse a comma-separated, highest-first placement-points ladder (e.g. "15,12,10,8"). Every entry
     * must be an integer; a blank or non-numeric entry is rejected (400) rather than silently dropped,
     * which would shift the ladder and mis-award placement points.
     */
    private static int[] parsePlacementPoints(String csv) {
        if (csv == null || csv.isBlank()) {
            return new int[0];
        }
        String[] parts = csv.split(",", -1);
        int[] ladder = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String trimmed = parts[i].trim();
            try {
                ladder[i] = Integer.parseInt(trimmed);
            } catch (NumberFormatException ex) {
                throw ApiException.badRequest(
                        "placementPoints must be a comma-separated list of integers; bad entry: '"
                                + parts[i] + "'");
            }
        }
        return ladder;
    }

    /** Placement points for a 1-based finishing rank, or 0 beyond the ladder. */
    private static int placementForRank(int[] ladder, int rank) {
        int idx = rank - 1;
        return (idx >= 0 && idx < ladder.length) ? ladder[idx] : 0;
    }

    /**
     * The players taking part in a match. For a FRANCHISE match these are the participating franchises'
     * rostered players; for an FFA match they are the players from the approved registrations tied to
     * the match (each squad's captain plus its accepted invitees). 404 if the match is missing.
     */
    @Transactional(readOnly = true)
    public List<MatchPlayerView> players(String id) {
        Match match = require(id);
        List<MatchPlayerView> out = new ArrayList<>();

        if (match.getMatchType() == MatchType.FFA) {
            // A player can appear in more than one approved registration for the same match; emit once.
            java.util.Set<UUID> seen = new java.util.HashSet<>();
            for (Registration reg : registrationRepository
                    .findByMatchIdAndStatus(match.getId(), RegistrationStatus.APPROVED)) {
                String squad = reg.getSquadName();
                Player captain = reg.getPlayer();
                if (captain != null && seen.add(captain.getId())) {
                    out.add(new MatchPlayerView(captain.getId().toString(), captain.getGamerTag(),
                            null, null, squad));
                }
                for (TeamInvite invite : teamInviteRepository
                        .findByRegistrationIdOrderByCreatedAtAsc(reg.getId())) {
                    if (invite.getStatus() == InviteStatus.ACCEPTED && invite.getInvitedPlayer() != null
                            && seen.add(invite.getInvitedPlayer().getId())) {
                        Player m = invite.getInvitedPlayer();
                        out.add(new MatchPlayerView(m.getId().toString(), m.getGamerTag(),
                                null, null, squad));
                    }
                }
            }
        } else {
            for (MatchParticipant mp : matchParticipantRepository.findByMatchId(match.getId())) {
                Franchise f = mp.getFranchise();
                if (f == null) {
                    continue;
                }
                for (Player p : playerRepository.findByFranchiseId(f.getId())) {
                    out.add(new MatchPlayerView(p.getId().toString(), p.getGamerTag(),
                            f.getId().toString(), f.getTag(), null));
                }
            }
        }
        return out;
    }

    /** Returns the per-round result tables for a match (round order, best rank first). 404 if missing. */
    @Transactional(readOnly = true)
    public List<MatchRoundView> rounds(String id) {
        Match match = require(id);
        return matchRoundRepository.findByMatchIdOrderByRoundNumberAsc(match.getId()).stream()
                .map(this::toRoundView)
                .toList();
    }

    private MatchRoundView toRoundView(MatchRound round) {
        // Per-player lines for this round, grouped by franchise so each team row can carry its breakdown.
        Map<UUID, List<MatchRoundView.PlayerStatView>> playersByFranchise = new HashMap<>();
        for (MatchRoundPlayerResult pr : matchRoundPlayerResultRepository
                .findByMatchRoundIdOrderByKillsDesc(round.getId())) {
            if (pr.getFranchise() == null) {
                continue;
            }
            Player p = pr.getPlayer();
            playersByFranchise.computeIfAbsent(pr.getFranchise().getId(), k -> new ArrayList<>())
                    .add(new MatchRoundView.PlayerStatView(
                            p == null ? null : p.getId().toString(),
                            p == null ? null : p.getGamerTag(),
                            pr.getKills(),
                            pr.getSurvivalSeconds()));
        }

        List<MatchRoundView.RoundResultView> rows =
                matchRoundResultRepository.findByMatchRoundIdOrderByRankAsc(round.getId()).stream()
                        .map(rr -> {
                            Franchise f = rr.getFranchise();
                            List<MatchRoundView.PlayerStatView> players = f == null ? List.of()
                                    : playersByFranchise.getOrDefault(f.getId(), List.of());
                            return new MatchRoundView.RoundResultView(
                                    rr.getRank(),
                                    f == null ? null : f.getId().toString(),
                                    f == null ? null : f.getName(),
                                    f == null ? null : f.getTag(),
                                    rr.getKills(),
                                    rr.getSurvivalSeconds(),
                                    rr.getPlacePts(),
                                    players);
                        })
                        .toList();
        return new MatchRoundView(round.getRoundNumber(), round.getMapName(), round.getMode(), rows);
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

    /** Load a player by its string id, or throw 404 (an unparseable id can never match). */
    private Player requirePlayer(String id) {
        return playerRepository.findById(parseId(id, "Player"))
                .orElseThrow(() -> ApiException.notFound("Player", id));
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
                match.getMatchType() == null ? null : match.getMatchType().name(),
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
                match.getMatchType() == null ? null : match.getMatchType().name(),
                match.getPointsPerKill(),
                match.getPlacementPoints(),
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
