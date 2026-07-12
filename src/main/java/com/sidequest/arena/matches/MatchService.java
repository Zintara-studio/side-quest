package com.sidequest.arena.matches;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.matches.dto.CreateMatchRequest;
import com.sidequest.arena.matches.dto.EnterResultsRequest;
import com.sidequest.arena.matches.dto.EnterRoundsRequest;
import com.sidequest.arena.matches.dto.GameMini;
import com.sidequest.arena.matches.dto.MatchLineupView;
import com.sidequest.arena.matches.dto.MatchMessageView;
import com.sidequest.arena.matches.dto.MatchPlayerView;
import com.sidequest.arena.matches.dto.MatchRoomView;
import com.sidequest.arena.matches.dto.MatchRoundView;
import com.sidequest.arena.matches.dto.MatchDetail;
import com.sidequest.arena.matches.dto.MatchSummary;
import com.sidequest.arena.matches.dto.ParticipantView;
import com.sidequest.arena.matches.dto.PostMatchMessageRequest;
import com.sidequest.arena.matches.dto.RescheduleMatchRequest;
import com.sidequest.arena.matches.dto.ResultEntry;
import com.sidequest.arena.matches.dto.ResultView;
import com.sidequest.arena.matches.dto.StartMatchRequest;
import com.sidequest.arena.matches.dto.UpdateMatchRequest;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.GameType;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchLineup;
import com.sidequest.arena.model.MatchMessage;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.MatchRound;
import com.sidequest.arena.model.MatchRoundPlayerResult;
import com.sidequest.arena.model.MatchRoundResult;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.MatchType;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.model.TeamInvite;
import com.sidequest.arena.model.User;
import com.sidequest.arena.model.InviteStatus;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.repo.AnnouncementRepository;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.MatchLineupRepository;
import com.sidequest.arena.repo.MatchMessageRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.MatchRoundPlayerResultRepository;
import com.sidequest.arena.repo.MatchRoundRepository;
import com.sidequest.arena.repo.MatchRoundResultRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.SeasonRepository;
import com.sidequest.arena.repo.TeamInviteRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.announcements.AnnouncementService;
import com.sidequest.arena.scoring.ScoringService;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final MatchLineupRepository matchLineupRepository;
    private final ResultRowRepository resultRowRepository;
    private final MatchRoundRepository matchRoundRepository;
    private final MatchRoundResultRepository matchRoundResultRepository;
    private final MatchRoundPlayerResultRepository matchRoundPlayerResultRepository;
    private final LeagueSettingsRepository leagueSettingsRepository;
    private final SeasonRepository seasonRepository;
    private final RegistrationRepository registrationRepository;
    private final TeamInviteRepository teamInviteRepository;
    private final MatchMessageRepository matchMessageRepository;
    private final AnnouncementRepository announcementRepository;
    private final DisputeRepository disputeRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ScoringService scoringService;
    private final AnnouncementService announcementService;
    private final AuditService auditService;

    public MatchService(MatchRepository matchRepository,
                        GameRepository gameRepository,
                        FranchiseRepository franchiseRepository,
                        PlayerRepository playerRepository,
                        MatchParticipantRepository matchParticipantRepository,
                        MatchLineupRepository matchLineupRepository,
                        ResultRowRepository resultRowRepository,
                        MatchRoundRepository matchRoundRepository,
                        MatchRoundResultRepository matchRoundResultRepository,
                        MatchRoundPlayerResultRepository matchRoundPlayerResultRepository,
                        LeagueSettingsRepository leagueSettingsRepository,
                        SeasonRepository seasonRepository,
                        RegistrationRepository registrationRepository,
                        TeamInviteRepository teamInviteRepository,
                        MatchMessageRepository matchMessageRepository,
                        AnnouncementRepository announcementRepository,
                        DisputeRepository disputeRepository,
                        UserRepository userRepository,
                        NotificationService notificationService,
                        ScoringService scoringService,
                        AnnouncementService announcementService,
                        AuditService auditService) {
        this.matchRepository = matchRepository;
        this.gameRepository = gameRepository;
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.matchLineupRepository = matchLineupRepository;
        this.resultRowRepository = resultRowRepository;
        this.matchRoundRepository = matchRoundRepository;
        this.matchRoundResultRepository = matchRoundResultRepository;
        this.matchRoundPlayerResultRepository = matchRoundPlayerResultRepository;
        this.leagueSettingsRepository = leagueSettingsRepository;
        this.seasonRepository = seasonRepository;
        this.registrationRepository = registrationRepository;
        this.teamInviteRepository = teamInviteRepository;
        this.matchMessageRepository = matchMessageRepository;
        this.announcementRepository = announcementRepository;
        this.disputeRepository = disputeRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.scoringService = scoringService;
        this.announcementService = announcementService;
        this.auditService = auditService;
    }

    /**
     * Lists fixtures (newest first), optionally filtered by status and/or game, then paginated.
     * Picks the repository finder matching the supplied filter combination.
     */
    @Transactional(readOnly = true)
    public PageResponse<MatchSummary> list(MatchStatus status, UUID gameId, String q, UUID franchiseId,
                                           String seasonId, String sort, Integer limit, String cursor) {
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

        // Optional franchise-participation filter (one query for the franchise's match ids, not per-match).
        if (franchiseId != null) {
            Set<UUID> franchiseMatchIds = matchParticipantRepository.findMatchIdsByFranchiseId(franchiseId);
            matches = matches.stream().filter(m -> franchiseMatchIds.contains(m.getId())).toList();
        }
        // Optional season filter — blank / "all" means every season; otherwise an exact season match.
        if (seasonId != null && !seasonId.isBlank() && !"all".equalsIgnoreCase(seasonId)) {
            matches = matches.stream()
                    .filter(m -> seasonId.equalsIgnoreCase(m.getSeasonId()))
                    .toList();
        }

        // No free-text search (the common path): sort + paginate the MATCH rows first, then load
        // participants only for the returned page — not for every match ever played.
        if (q == null || q.isBlank()) {
            List<Match> sorted = new ArrayList<>(matches);
            sorted.sort(matchEntityComparator(sort));
            PageResponse<Match> page = Cursors.paginate(sorted, cursor, limit);
            Map<UUID, List<MatchParticipant>> pageParticipants = page.items().isEmpty() ? Map.of()
                    : matchParticipantRepository
                            .findByMatchIdIn(page.items().stream().map(Match::getId).toList())
                            .stream().collect(Collectors.groupingBy(mp -> mp.getMatch().getId()));
            List<MatchSummary> pageSummaries = page.items().stream()
                    .map(m -> toSummary(m, pageParticipants)).toList();
            return PageResponse.of(pageSummaries, page.nextCursor(), page.limit());
        }

        // Free-text search needs participant names/tags for EVERY candidate, so this (rarer) path
        // batch-loads them all in one query before filtering.
        Map<UUID, List<MatchParticipant>> participantsByMatch = matches.isEmpty() ? Map.of()
                : matchParticipantRepository.findByMatchIdIn(matches.stream().map(Match::getId).toList())
                        .stream().collect(Collectors.groupingBy(mp -> mp.getMatch().getId()));
        String needle = q.trim().toLowerCase();
        matches = matches.stream().filter(m -> matchMatches(m, needle, participantsByMatch)).toList();

        List<MatchSummary> summaries = new ArrayList<>(
                matches.stream().map(m -> toSummary(m, participantsByMatch)).toList());
        summaries.sort(matchComparator(sort));
        return Cursors.paginate(summaries, cursor, limit);
    }

    /**
     * Sort comparator over Match entities — MUST mirror {@link #matchComparator} key-for-key (it sorts
     * the mapped summaries on the search path) so both paths page in the same order.
     */
    private static Comparator<Match> matchEntityComparator(String sort) {
        Comparator<Match> byScheduled = Comparator.comparing(Match::getScheduledAt,
                Comparator.nullsLast(Comparator.naturalOrder()));
        String s = sort == null ? "" : sort.trim().toLowerCase();
        Comparator<Match> base = switch (s) {
            case "scheduledat" -> byScheduled;
            case "status" -> Comparator.comparing(m -> m.getStatus() == null ? "" : m.getStatus().name());
            case "game" -> Comparator.comparing(m -> m.getGame() == null || m.getGame().getName() == null
                    ? "" : m.getGame().getName(), String.CASE_INSENSITIVE_ORDER);
            default -> byScheduled.reversed();
        };
        return base.thenComparing(m -> m.getId().toString());
    }

    /** Whether a fixture matches the free-text needle (game name, arena, format, or participant tag/name). */
    private boolean matchMatches(Match m, String needle, Map<UUID, List<MatchParticipant>> participantsByMatch) {
        if (m.getArena() != null && m.getArena().toLowerCase().contains(needle)) {
            return true;
        }
        if (m.getFormat() != null && m.getFormat().toLowerCase().contains(needle)) {
            return true;
        }
        if (m.getGame() != null && m.getGame().getName() != null
                && m.getGame().getName().toLowerCase().contains(needle)) {
            return true;
        }
        for (MatchParticipant p : participantsByMatch.getOrDefault(m.getId(), List.of())) {
            Franchise f = p.getFranchise();
            if (f != null && ((f.getTag() != null && f.getTag().toLowerCase().contains(needle))
                    || (f.getName() != null && f.getName().toLowerCase().contains(needle)))) {
                return true;
            }
        }
        return false;
    }

    /** Sort comparator over fixtures; defaults to newest scheduled first, with an id tiebreaker. */
    private static Comparator<MatchSummary> matchComparator(String sort) {
        Comparator<MatchSummary> byScheduled = Comparator.comparing(MatchSummary::scheduledAt,
                Comparator.nullsLast(Comparator.naturalOrder()));
        String s = sort == null ? "" : sort.trim().toLowerCase();
        Comparator<MatchSummary> base = switch (s) {
            case "scheduledat" -> byScheduled;
            case "status" -> Comparator.comparing(ms -> ms.status() == null ? "" : ms.status());
            case "game" -> Comparator.comparing(ms -> ms.game() == null || ms.game().name() == null
                    ? "" : ms.game().name(), String.CASE_INSENSITIVE_ORDER);
            default -> byScheduled.reversed();
        };
        return base.thenComparing(MatchSummary::id);
    }

    /** The code of the currently ACTIVE season, or null when between seasons. */
    private String activeSeasonCode() {
        return seasonRepository.findFirstByStatusOrderByStartedAtDesc(SeasonStatus.ACTIVE)
                .map(com.sidequest.arena.model.Season::getCode)
                .orElse(null);
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

        if (request.scheduledAt() != null && request.scheduledAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("A match cannot be scheduled in the past");
        }

        Match match = new Match();
        match.setGame(game);
        match.setScheduledAt(request.scheduledAt());
        match.setStatus(MatchStatus.SCHEDULED);
        match.setMatchType(request.matchType() != null ? request.matchType() : MatchType.FRANCHISE);
        match.setArena(request.arena());
        match.setFormat(request.format());
        // Tag the fixture with the active season when the caller didn't specify one, so in-season match
        // lists stay filterable; a genuine off-season fixture stays null and is surfaced by the client's
        // null-season handling.
        match.setSeasonId(request.seasonId() != null ? request.seasonId() : activeSeasonCode());
        // Seed the fixture's scoring snapshot from the GAME's own system-wide scoring config (adjustable
        // per match at result entry). A blank ladder falls back to the genre default; non-placement
        // genres (TACTICAL/SPORTS/FIGHTING) never carry a ladder (scored on kills/score alone).
        match.setPointsPerKill(game.getPointsPerKill());
        GameType gameType = game.getGameType();
        String ladder = game.getPlacementPoints();
        if (ladder == null || ladder.isBlank()) {
            ladder = gameType != null ? gameType.defaultPlacementPoints() : "";
        }
        if (gameType != null && !gameType.usesPlacement()) {
            ladder = "";
        }
        match.setPlacementPoints(ladder);
        Match saved = matchRepository.save(match);

        if (request.participantFranchiseIds() != null) {
            for (String franchiseId : request.participantFranchiseIds()) {
                Franchise franchise = requireFranchise(franchiseId);
                if (!franchise.isActive()) {
                    throw ApiException.badRequest("Franchise '" + franchise.getName()
                            + "' is discarded and can't be added to a fixture");
                }
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
            // Once results are published the schedule is locked (mirrors start/reschedule/delete).
            if (match.getResultsPublishedAt() != null) {
                throw ApiException.badRequest("Results are published for this match — its schedule is locked.");
            }
            // Mirror create()'s guard so the generic patch can't reschedule into the past either.
            if (request.scheduledAt().isBefore(Instant.now())) {
                throw ApiException.badRequest("A match cannot be scheduled in the past");
            }
            match.setScheduledAt(request.scheduledAt());
            changes.add("scheduledAt=" + request.scheduledAt());
        }
        boolean cancelled = false;
        if (request.status() != null && request.status() != match.getStatus()) {
            MatchStatus to = request.status();
            // The generic patch only owns the CANCELLED transition; LIVE / AWAITING_RESULT / COMPLETED
            // must go through start / end / results so their side effects (room, notifications, scoring,
            // resultsPublishedAt) always fire and the state machine can't be forced into an invalid state.
            if (to != MatchStatus.CANCELLED) {
                throw ApiException.badRequest(
                        "Use the start / end / results endpoints to move a fixture to " + to + ".");
            }
            // Cancelling is allowed at ANY stage — including a completed match (an admin voiding an unfair
            // result / forcing a rematch). A cancelled fixture is excluded from the standings by the
            // scoring engine, so we recompute below to drop any published points it had. It cannot,
            // however, be voided once its season is finished: those points are baked into the frozen
            // season snapshot + all-time table, which the recompute engine deliberately never rewrites.
            if (belongsToFinishedSeason(match)) {
                throw ApiException.badRequest(
                        "This match belongs to a finished season and is part of the frozen historical "
                                + "standings — it can no longer be cancelled.");
            }
            match.setStatus(MatchStatus.CANCELLED);
            changes.add("status=CANCELLED");
            announcementService.closeForMatch(match.getId()); // a cancelled fixture no longer accepts sign-ups
            cancelled = true;
        }
        if (request.arena() != null) {
            match.setArena(request.arena());
            changes.add("arena=" + request.arena());
        }
        if (request.format() != null) {
            match.setFormat(request.format());
            changes.add("format=" + request.format());
        }
        if (request.roomId() != null) {
            match.setRoomId(request.roomId().isBlank() ? null : request.roomId().trim());
            changes.add("roomId");
        }

        Match saved = matchRepository.save(match);

        // A cancelled (possibly completed) fixture must drop out of the league table — and its
        // participants deserve a heads-up (start/end/reschedule/delete all notify; voiding shouldn't
        // silently erase points from under a team).
        if (cancelled) {
            scoringService.recomputeStandings();
            String gameName = saved.getGame() != null ? saved.getGame().getName() : "A match";
            notifyParticipants(saved, "Match voided",
                    gameName + " was cancelled by the league" +
                            (saved.getResultsPublishedAt() != null
                                    ? " — its published result no longer counts toward the standings."
                                    : "."));
        }

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
        // Row-lock the match: the delete-then-insert rewrite below is only idempotent when publishes
        // for the same fixture run one at a time (a double-click racing itself would double every row).
        Match match = requireForUpdate(id);
        // A cancelled fixture is terminal (mirrors start/reschedule) — publishing results must not
        // silently resurrect it back to COMPLETED and restore its voided points.
        if (match.getStatus() == MatchStatus.CANCELLED) {
            throw ApiException.badRequest("A cancelled match can't have results published.");
        }
        // A finished season's standings are frozen — its fixtures can't gain or change results.
        if (belongsToFinishedSeason(match)) {
            throw ApiException.badRequest(
                    "This match belongs to a finished season and is part of the frozen historical "
                            + "standings — its results can no longer be edited.");
        }

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

        // The fixture is over — close any registration call tied to it so its Register button disappears.
        announcementService.closeForMatch(match.getId());

        // Recompute standings and emit realtime updates.
        scoringService.onResultsPublished(match);

        // Close the loop for the players who were told "results are pending" at match end.
        notifyParticipants(match, NotificationType.RESULT, "Results published",
                (match.getGame() != null ? match.getGame().getName() : "Your match")
                        + " results are in — the standings are updated.");

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
        // Row-lock the match — see enterResults; concurrent publishes must serialize.
        Match match = requireForUpdate(id);
        // A cancelled fixture is terminal (mirrors start/reschedule) — publishing rounds must not
        // silently resurrect it back to COMPLETED and restore its voided points.
        if (match.getStatus() == MatchStatus.CANCELLED) {
            throw ApiException.badRequest("A cancelled match can't have results published.");
        }
        // A finished season's standings are frozen — its fixtures can't gain or change results.
        if (belongsToFinishedSeason(match)) {
            throw ApiException.badRequest(
                    "This match belongs to a finished season and is part of the frozen historical "
                            + "standings — its results can no longer be edited.");
        }

        // Apply (and persist) the scoring weights for this fixture.
        if (request.pointsPerKill() != null) {
            match.setPointsPerKill(request.pointsPerKill());
        }
        // A non-null value is applied even when empty: an explicit "" CLEARS the ladder (non-BR
        // single-result entry sends "" so scores aren't inflated by stale placement points). Only an
        // omitted/null field means "keep the existing weights".
        if (request.placementPoints() != null) {
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

        // FFA matches are scored per individual entrant (no franchise); FRANCHISE matches per franchise.
        boolean ffa = match.getMatchType() == MatchType.FFA;
        Map<UUID, int[]> aggregate = new HashMap<>(); // entrant id (franchise or player) -> [kills, placePts]
        Map<UUID, Franchise> franchises = new HashMap<>();
        Map<UUID, Player> ffaEntrants = new HashMap<>();

        for (EnterRoundsRequest.RoundEntry roundEntry : request.rounds()) {
            MatchRound round = new MatchRound();
            round.setMatch(match);
            round.setRoundNumber(roundEntry.roundNumber());
            round.setMapName(roundEntry.mapName());
            round.setMode(roundEntry.mode());
            MatchRound savedRound = matchRoundRepository.save(round);

            for (EnterRoundsRequest.RoundResultEntry row : roundEntry.rows()) {
                Franchise franchise = null;
                Player entrant = null;
                UUID key;
                if (ffa) {
                    // The entrant is an individual player. Prefer the explicit playerId; fall back to the
                    // first per-player breakdown line if only that was supplied.
                    String pid = row.playerId();
                    if ((pid == null || pid.isBlank()) && row.players() != null && !row.players().isEmpty()) {
                        pid = row.players().get(0).playerId();
                    }
                    if (pid == null || pid.isBlank()) {
                        throw ApiException.badRequest("Each FFA result row must identify a player");
                    }
                    entrant = requirePlayer(pid);
                    key = entrant.getId();
                    ffaEntrants.put(key, entrant);
                } else {
                    franchise = requireFranchise(row.franchiseId());
                    key = franchise.getId();
                    franchises.put(key, franchise);
                }

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
                result.setPlayer(entrant);
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
                        pr.setFranchise(franchise); // null for FFA entrants
                        pr.setPlayer(player);
                        pr.setKills(pe.kills());
                        pr.setSurvivalSeconds(pe.survivalSeconds());
                        matchRoundPlayerResultRepository.save(pr);
                    }
                }

                int[] totals = aggregate.computeIfAbsent(key, k -> new int[2]);
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
            row.setFranchise(franchises.get(entry.getKey())); // null for FFA
            row.setPlayer(ffaEntrants.get(entry.getKey()));    // null for FRANCHISE
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

        // The fixture is over — close any registration call tied to it so its Register button disappears.
        announcementService.closeForMatch(match.getId());

        scoringService.onResultsPublished(match);

        // Close the loop for the players who were told "results are pending" at match end.
        notifyParticipants(match, NotificationType.RESULT, "Results published",
                (match.getGame() != null ? match.getGame().getName() : "Your match")
                        + " results are in — the standings are updated.");

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
        return resolveParticipants(match).stream()
                .map(pt -> new MatchPlayerView(
                        pt.player().getId().toString(),
                        pt.player().getGamerTag(),
                        pt.franchise() != null ? pt.franchise().getId().toString() : null,
                        pt.franchise() != null ? pt.franchise().getTag() : null,
                        pt.squad()))
                .toList();
    }

    /** A resolved match participant: the player, their franchise (null for FFA), and squad (FFA only). */
    private record Participant(Player player, Franchise franchise, String squad) {
    }

    /**
     * The canonical "who is taking part in this match" resolution, shared by {@link #players} and the
     * participant notification fan-out so the two can never diverge. FRANCHISE matches field each
     * participating franchise's per-match lineup (full roster when none is set); FFA matches field each
     * live registration's captain plus its accepted invitees, deduped by player.
     */
    private List<Participant> resolveParticipants(Match match) {
        List<Participant> out = new ArrayList<>();
        if (match.getMatchType() == MatchType.FFA) {
            Set<UUID> seen = new java.util.HashSet<>();
            for (Registration reg : registrationRepository.findByMatchId(match.getId())) {
                RegistrationStatus st = reg.getStatus();
                if (st != RegistrationStatus.FORMING && st != RegistrationStatus.ACTIVE
                        && st != RegistrationStatus.LOCKED) {
                    continue;
                }
                String squad = reg.getSquadName();
                Player captain = reg.getPlayer();
                if (captain != null && seen.add(captain.getId())) {
                    out.add(new Participant(captain, null, squad));
                }
                for (TeamInvite invite : teamInviteRepository
                        .findByRegistrationIdOrderByCreatedAtAsc(reg.getId())) {
                    if (invite.getStatus() == InviteStatus.ACCEPTED && invite.getInvitedPlayer() != null
                            && seen.add(invite.getInvitedPlayer().getId())) {
                        out.add(new Participant(invite.getInvitedPlayer(), null, squad));
                    }
                }
            }
        } else {
            for (MatchParticipant mp : matchParticipantRepository.findByMatchId(match.getId())) {
                Franchise f = mp.getFranchise();
                if (f == null) {
                    continue;
                }
                List<MatchLineup> lineup = matchLineupRepository
                        .findByMatchIdAndFranchiseId(match.getId(), f.getId());
                if (!lineup.isEmpty()) {
                    for (MatchLineup ml : lineup) {
                        if (ml.getPlayer() != null) {
                            out.add(new Participant(ml.getPlayer(), f, null));
                        }
                    }
                } else {
                    for (Player p : playerRepository.findByFranchiseId(f.getId())) {
                        out.add(new Participant(p, f, null));
                    }
                }
            }
        }
        return out;
    }

    /** Every distinct, notifiable user taking part in a match (skips players with no linked user). */
    private List<User> participantUsers(Match match) {
        return resolveParticipants(match).stream()
                .map(pt -> pt.player().getUser())
                .filter(Objects::nonNull)
                .toList();
    }

    /** Fan a MATCH notification out to all of a match's participants (deep-linking to the match). */
    private void notifyParticipants(Match match, String title, String body) {
        notifyParticipants(match, NotificationType.MATCH, title, body);
    }

    /** Fan a typed notification out to all of a match's participants (deep-linking to the match). */
    private void notifyParticipants(Match match, NotificationType type, String title, String body) {
        notificationService.createMany(participantUsers(match), type, title, body,
                "/match/" + match.getId());
    }

    /** Whether a franchise's owner/manager is the given user. */
    private static boolean leadsFranchise(Franchise franchise, UUID userId) {
        if (franchise == null) {
            return false;
        }
        Player owner = franchise.getOwnerPlayer();
        Player manager = franchise.getManagerPlayer();
        return (owner != null && owner.getUser() != null && owner.getUser().getId().equals(userId))
                || (manager != null && manager.getUser() != null && manager.getUser().getId().equals(userId));
    }

    /**
     * Per-match cache of the user-ids allowed into the room (participants + participating leaders).
     * Room access is re-resolved by every 30s my-rooms poll from every signed-in user, so event night
     * would otherwise re-run the full lineup/roster resolution once per LIVE match per user per poll.
     * Short TTL bounds staleness from roster changes made outside this service (trades, invite accepts);
     * lineup edits evict explicitly below — the privacy-relevant case.
     */
    private final com.github.benmanes.caffeine.cache.Cache<UUID, Set<UUID>> roomAccessCache =
            com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
                    .expireAfterWrite(java.time.Duration.ofSeconds(30))
                    .maximumSize(500)
                    .build();

    /** Whether the given player may see/enter the match room: a participant, or a participating leader. */
    private boolean canAccessRoom(Match match, Player player, UUID userId) {
        Set<UUID> allowed = roomAccessCache.get(match.getId(), key -> roomUserIds(match));
        return allowed.contains(userId);
    }

    /** Resolve the full set of user-ids with room access for a match (see {@link #canAccessRoom}). */
    private Set<UUID> roomUserIds(Match match) {
        Set<UUID> allowed = new HashSet<>();
        for (Participant pt : resolveParticipants(match)) {
            User u = pt.player().getUser();
            if (u != null) {
                allowed.add(u.getId());
            }
        }
        if (match.getMatchType() == MatchType.FRANCHISE) {
            for (MatchParticipant mp : matchParticipantRepository.findByMatchId(match.getId())) {
                Franchise f = mp.getFranchise();
                if (f == null) {
                    continue;
                }
                for (Player leader : new Player[] {f.getOwnerPlayer(), f.getManagerPlayer()}) {
                    if (leader != null && leader.getUser() != null) {
                        allowed.add(leader.getUser().getId());
                    }
                }
            }
        }
        return allowed;
    }

    /**
     * The per-franchise lineups for a match: one {@link MatchLineupView} per participating franchise,
     * carrying the players it has assigned (an empty list when the franchise has set no lineup). 404 if
     * the match is missing.
     */
    @Transactional(readOnly = true)
    public List<MatchLineupView> getLineups(String id) {
        Match match = require(id);
        List<MatchLineupView> out = new ArrayList<>();
        for (MatchParticipant mp : matchParticipantRepository.findByMatchId(match.getId())) {
            Franchise f = mp.getFranchise();
            if (f == null) {
                continue;
            }
            List<MatchPlayerView> players = new ArrayList<>();
            for (MatchLineup ml : matchLineupRepository
                    .findByMatchIdAndFranchiseId(match.getId(), f.getId())) {
                Player p = ml.getPlayer();
                if (p == null) {
                    continue;
                }
                players.add(new MatchPlayerView(p.getId().toString(), p.getGamerTag(),
                        f.getId().toString(), f.getTag(), null));
            }
            out.add(new MatchLineupView(f.getId().toString(), f.getTag(), f.getName(), players));
        }
        return out;
    }

    /**
     * Set (replace) a participating franchise's fielded lineup for a match. Allowed for an admin or the
     * franchise's owner/manager. The match must be a FRANCHISE match, the franchise must be
     * participating, and every supplied player must be on that franchise. The prior lineup is cleared
     * and replaced. Returns the updated {@link MatchLineupView}.
     */
    @Transactional
    public MatchLineupView setLineup(String id, String franchiseId, List<String> playerIds) {
        Match match = require(id);
        if (match.getMatchType() != MatchType.FRANCHISE) {
            throw ApiException.badRequest("Lineups can only be set on franchise matches");
        }
        Franchise franchise = requireFranchise(franchiseId);
        if (!matchParticipantRepository.existsByMatchIdAndFranchiseId(match.getId(), franchise.getId())) {
            throw ApiException.badRequest("Franchise is not participating in this match");
        }

        // Authorize: admin, or the franchise owner / manager (by their linked user account).
        if (!SecurityUtils.isAdmin()) {
            UUID userId = SecurityUtils.currentUserId();
            Player owner = franchise.getOwnerPlayer();
            Player manager = franchise.getManagerPlayer();
            boolean isOwner = owner != null && owner.getUser() != null
                    && owner.getUser().getId().equals(userId);
            boolean isManager = manager != null && manager.getUser() != null
                    && manager.getUser().getId().equals(userId);
            if (!isOwner && !isManager) {
                throw ApiException.forbidden(
                        "Only the franchise owner, manager, or an admin can set the lineup");
            }
        }

        // Validate every player resolves and is on this franchise before mutating. De-duplicate the
        // incoming ids (preserving order) so a repeated id doesn't violate the lineup unique constraint.
        List<Player> lineupPlayers = new ArrayList<>();
        if (playerIds != null) {
            for (String playerId : new java.util.LinkedHashSet<>(playerIds)) {
                Player player = requirePlayer(playerId);
                Franchise pf = player.getFranchise();
                if (pf == null || !pf.getId().equals(franchise.getId())) {
                    throw ApiException.badRequest(
                            "Player " + player.getGamerTag() + " is not on this franchise");
                }
                lineupPlayers.add(player);
            }
        }

        // Snapshot the prior lineup (by user) BEFORE replacing it, so notifications fire by DELTA:
        // newly-fielded players are told they're in, dropped players are told they were benched, and
        // players who stay in the lineup aren't re-notified on every save.
        Map<UUID, User> previousUsers = new LinkedHashMap<>();
        for (MatchLineup ml : matchLineupRepository.findByMatchIdAndFranchiseId(match.getId(), franchise.getId())) {
            Player prior = ml.getPlayer();
            if (prior != null && prior.getUser() != null) {
                previousUsers.put(prior.getUser().getId(), prior.getUser());
            }
        }

        // Replace the existing lineup atomically.
        matchLineupRepository.deleteByMatchIdAndFranchiseId(match.getId(), franchise.getId());
        matchLineupRepository.flush();
        for (Player player : lineupPlayers) {
            MatchLineup ml = new MatchLineup();
            ml.setMatch(match);
            ml.setFranchise(franchise);
            ml.setPlayer(player);
            matchLineupRepository.save(ml);
        }

        auditService.record("match.lineup.set", "Match", match.getId().toString(),
                franchise.getTag() + " lineup set to " + lineupPlayers.size() + " player(s)");

        // The lineup defines who may enter the room — drop the cached access set immediately.
        roomAccessCache.invalidate(match.getId());

        // Notify the delta: newly-fielded players and newly-benched players (deduped by user).
        Map<UUID, User> currentUsers = new LinkedHashMap<>();
        for (Player player : lineupPlayers) {
            if (player.getUser() != null) {
                currentUsers.put(player.getUser().getId(), player.getUser());
            }
        }
        String gameName = match.getGame() != null ? match.getGame().getName() : "a match";
        List<User> added = currentUsers.entrySet().stream()
                .filter(e -> !previousUsers.containsKey(e.getKey()))
                .map(Map.Entry::getValue)
                .toList();
        List<User> dropped = previousUsers.entrySet().stream()
                .filter(e -> !currentUsers.containsKey(e.getKey()))
                .map(Map.Entry::getValue)
                .toList();
        notificationService.createMany(added, NotificationType.MATCH, "You're in the lineup",
                franchise.getName() + " fielded you for " + gameName + ".", "/match/" + match.getId());
        notificationService.createMany(dropped, NotificationType.MATCH, "You were benched",
                franchise.getName() + " removed you from the lineup for " + gameName + ".",
                "/match/" + match.getId());

        List<MatchPlayerView> players = lineupPlayers.stream()
                .map(p -> new MatchPlayerView(p.getId().toString(), p.getGamerTag(),
                        franchise.getId().toString(), franchise.getTag(), null))
                .toList();
        return new MatchLineupView(franchise.getId().toString(), franchise.getTag(),
                franchise.getName(), players);
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
        // Per-player breakdown lines for this round, grouped by entrant key: the franchise id for
        // FRANCHISE rows, or the player id for FFA rows (which have no franchise).
        Map<UUID, List<MatchRoundView.PlayerStatView>> playersByKey = new HashMap<>();
        for (MatchRoundPlayerResult pr : matchRoundPlayerResultRepository
                .findByMatchRoundIdOrderByKillsDesc(round.getId())) {
            Player p = pr.getPlayer();
            UUID key = pr.getFranchise() != null ? pr.getFranchise().getId()
                    : (p != null ? p.getId() : null);
            if (key == null) {
                continue;
            }
            playersByKey.computeIfAbsent(key, k -> new ArrayList<>())
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
                            Player pl = rr.getPlayer();
                            // FFA entrants are surfaced with their gamer tag in the name/tag slots so the
                            // existing round tables render them like a single-player "team".
                            String rowId = f != null ? f.getId().toString()
                                    : (pl != null ? pl.getId().toString() : null);
                            String rowName = f != null ? f.getName()
                                    : (pl != null ? pl.getGamerTag() : null);
                            String rowTag = f != null ? f.getTag()
                                    : (pl != null ? pl.getGamerTag() : null);
                            UUID key = f != null ? f.getId() : (pl != null ? pl.getId() : null);
                            List<MatchRoundView.PlayerStatView> players =
                                    key == null ? List.of() : playersByKey.getOrDefault(key, List.of());
                            return new MatchRoundView.RoundResultView(
                                    rr.getRank(),
                                    rowId,
                                    rowName,
                                    rowTag,
                                    rr.getKills(),
                                    rr.getSurvivalSeconds(),
                                    rr.getPlacePts(),
                                    players);
                        })
                        .toList();
        return new MatchRoundView(round.getRoundNumber(), round.getMapName(), round.getMode(), rows);
    }

    // ---- lifecycle: start / end / reschedule / delete ----

    /**
     * Admin: take a fixture live and (optionally) set its room code + venue. Notifies every participant
     * that the match has started. Blocked for an already-completed match.
     */
    @Transactional
    public MatchDetail start(String id, StartMatchRequest request) {
        Match match = require(id);
        // Key the lock off the DURABLE results marker (not the mutable status), so a match whose results
        // are in the standings can never be restarted; a cancelled fixture can't be resurrected either.
        if (match.getResultsPublishedAt() != null) {
            throw ApiException.badRequest("A completed match with published results can't be started again.");
        }
        if (match.getStatus() == MatchStatus.CANCELLED) {
            throw ApiException.badRequest("A cancelled match can't be started.");
        }
        match.setStatus(MatchStatus.LIVE);
        if (request != null) {
            if (request.roomId() != null) {
                match.setRoomId(request.roomId().isBlank() ? null : request.roomId().trim());
            }
            if (request.venue() != null && !request.venue().isBlank()) {
                match.setArena(request.venue().trim());
            }
        }
        Match saved = matchRepository.save(match);

        String gameName = saved.getGame() != null ? saved.getGame().getName() : "Your match";
        notifyParticipants(saved, "Match is live",
                gameName + " is live" + (saved.getRoomId() != null ? " — room " + saved.getRoomId() : "")
                        + ". Open the match room for details.");
        auditService.record("match.start", "Match", saved.getId().toString(),
                "LIVE" + (saved.getRoomId() != null ? " room=" + saved.getRoomId() : ""));
        return toDetail(saved);
    }

    /**
     * Admin: end a live match — it moves to {@code AWAITING_RESULT} (results pending) and the room is
     * closed (roomId cleared). Notifies participants. Only allowed from LIVE.
     */
    @Transactional
    public MatchDetail end(String id) {
        Match match = require(id);
        if (match.getStatus() != MatchStatus.LIVE) {
            throw ApiException.badRequest("Only a live match can be ended.");
        }
        match.setStatus(MatchStatus.AWAITING_RESULT);
        match.setRoomId(null); // the room only exists while the match is live
        Match saved = matchRepository.save(match);

        String gameName = saved.getGame() != null ? saved.getGame().getName() : "Your match";
        notifyParticipants(saved, "Match ended", gameName + " has ended — results are pending.");
        auditService.record("match.end", "Match", saved.getId().toString(), "AWAITING_RESULT");
        return toDetail(saved);
    }

    /** Admin: move a fixture to a new future time and notify participants. Blocked once completed. */
    @Transactional
    public MatchDetail reschedule(String id, RescheduleMatchRequest request) {
        Match match = require(id);
        // Durable marker: once results are published the fixture is locked (mirrors start/delete).
        if (match.getResultsPublishedAt() != null) {
            throw ApiException.badRequest("A completed match with published results can't be rescheduled.");
        }
        Instant when = request.scheduledAt();
        if (when.isBefore(Instant.now())) {
            throw ApiException.badRequest("A match cannot be scheduled in the past");
        }
        match.setScheduledAt(when);
        Match saved = matchRepository.save(match);

        String gameName = saved.getGame() != null ? saved.getGame().getName() : "Your match";
        notifyParticipants(saved, "Match rescheduled", gameName + " was moved to a new time.");
        auditService.record("match.reschedule", "Match", saved.getId().toString(), "scheduledAt=" + when);
        return toDetail(saved);
    }

    /**
     * Admin: delete a fixture at any stage — including a completed one whose results are published (its
     * ResultRows are removed and standings recomputed below, so its points cleanly drop out of the live
     * league table). A fixture whose season has already been FINISHED can't be deleted, since its points
     * are frozen into the season snapshot + all-time table. Participants are notified, then every child
     * row is cleaned up (no JPA cascade is configured): FFA registrations + their invites are removed,
     * nullable links (announcements, disputes) are detached, and the hard-FK children (messages, lineups,
     * participants, rounds/results) are deleted before the match itself.
     */
    @Transactional
    public void delete(String id) {
        // A match can be deleted at ANY stage — including a completed one, so an admin can pull an unfair
        // fixture / force a rematch. Deleting a published match removes its ResultRows and then
        // recomputes standings (below), so its points cleanly drop out of the league table.
        Match match = require(id);
        // ...but not once its season is finished: the recompute engine no longer rewrites finished-season
        // standings, so a delete would orphan the frozen snapshot into a permanent over-credit.
        if (belongsToFinishedSeason(match)) {
            throw ApiException.badRequest(
                    "This match belongs to a finished season and is part of the frozen historical "
                            + "standings — it can no longer be deleted.");
        }
        UUID matchId = match.getId();

        // Tell participants before the fixture disappears.
        String gameName = match.getGame() != null ? match.getGame().getName() : "A match";
        notifyParticipants(match, "Match removed", gameName + " you were part of was removed.");

        // FFA sign-ups are match-specific — delete them and their squad invites.
        List<Registration> registrations = registrationRepository.findByMatchId(matchId);
        for (Registration reg : registrations) {
            teamInviteRepository.deleteAll(
                    teamInviteRepository.findByRegistrationIdOrderByCreatedAtAsc(reg.getId()));
        }
        registrationRepository.deleteAll(registrations);

        // Detach nullable references (keep the records, just unlink the match).
        announcementRepository.detachMatch(matchId);
        disputeRepository.detachMatch(matchId);

        // Delete hard-FK children (no cascade configured).
        matchMessageRepository.deleteByMatchId(matchId);
        matchLineupRepository.deleteByMatchId(matchId);
        matchParticipantRepository.deleteByMatchId(matchId);
        matchRoundPlayerResultRepository.deleteByMatchId(matchId);
        matchRoundResultRepository.deleteByMatchId(matchId);
        matchRoundRepository.deleteByMatchId(matchId);
        resultRowRepository.deleteByMatchId(matchId);

        // Flush every child delete/detach before removing the parent so no FK is left dangling.
        matchRepository.flush();
        matchRepository.delete(match);
        roomAccessCache.invalidate(matchId);

        // Recompute standings from the surviving result rows, so a deleted (possibly completed) match's
        // points cleanly drop out of the league table. Idempotent — a no-op when the match had no results.
        scoringService.recomputeStandings();

        auditService.record("match.delete", "Match", matchId.toString(), gameName);
    }

    // ---- match room (participant-only, polled) ----

    /**
     * The match room for a fixture: its (private) lobby code + venue and message history. Readable only
     * by the match's participants, a participating franchise's leadership, or an admin — 401 for
     * anonymous callers, 403 for authenticated non-participants (so the lobby code never leaks).
     */
    @Transactional(readOnly = true)
    public MatchRoomView getRoom(String id) {
        Match match = require(id);
        if (!SecurityUtils.isAdmin()) {
            UUID userId = SecurityUtils.currentUserId(); // 401 when anonymous
            Player player = playerRepository.findByUserId(userId).orElse(null);
            if (player == null || !canAccessRoom(match, player, userId)) {
                throw ApiException.forbidden("The match room is for the match's participants.");
            }
        }
        List<MatchMessageView> messages = matchMessageRepository
                .findByMatchIdOrderByCreatedAtAsc(match.getId()).stream()
                .map(MatchService::toMessageView)
                .toList();
        boolean live = match.getStatus() == MatchStatus.LIVE;
        return new MatchRoomView(
                match.getId().toString(),
                match.getStatus() == null ? null : match.getStatus().name(),
                live,
                match.getRoomId(),
                match.getArena(),
                messages);
    }

    /** Admin: post a message into a live match room. Only allowed while the match is LIVE. */
    @Transactional
    public MatchMessageView postMessage(String id, PostMatchMessageRequest request) {
        Match match = require(id);
        if (match.getStatus() != MatchStatus.LIVE) {
            throw ApiException.badRequest("Messages can only be posted while the match is live.");
        }
        User author = userRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.unauthorized("Authentication required"));
        MatchMessage message = new MatchMessage();
        message.setMatch(match);
        message.setAuthor(author);
        message.setBody(request.body().trim());
        MatchMessage saved = matchMessageRepository.save(message);
        auditService.record("match.message", "Match", match.getId().toString(), "posted a room message");
        return toMessageView(saved);
    }

    /**
     * The current user's live match rooms — the LIVE fixtures they participate in (or lead), for the
     * home "match room" card. Empty when the caller has no player profile or no live matches.
     */
    @Transactional(readOnly = true)
    public List<MatchSummary> myMatchRooms() {
        UUID userId = SecurityUtils.currentUserId();
        Player player = playerRepository.findByUserId(userId).orElse(null);
        if (player == null) {
            return List.of();
        }
        List<Match> mine = matchRepository.findByStatusOrderByScheduledAtDesc(MatchStatus.LIVE).stream()
                .filter(m -> canAccessRoom(m, player, userId))
                .toList();
        Map<UUID, List<MatchParticipant>> participantsByMatch = mine.isEmpty() ? Map.of()
                : matchParticipantRepository.findByMatchIdIn(mine.stream().map(Match::getId).toList())
                        .stream().collect(Collectors.groupingBy(mp -> mp.getMatch().getId()));
        return mine.stream().map(m -> toSummary(m, participantsByMatch)).toList();
    }

    private static MatchMessageView toMessageView(MatchMessage message) {
        return new MatchMessageView(
                message.getId().toString(),
                message.getAuthor() != null ? message.getAuthor().getName() : null,
                message.getBody(),
                message.getCreatedAt());
    }

    // ---- loaders ----

    /** Load a match by its string id, or throw 404 (an unparseable id can never match). */
    private Match require(String idOrSlug) {
        return matchRepository.findById(resolveMatchId(idOrSlug))
                .orElseThrow(() -> ApiException.notFound("Match", idOrSlug));
    }

    /** Like {@link #require}, but row-locked — mutations that must serialize per match use this. */
    private Match requireForUpdate(String idOrSlug) {
        return matchRepository.findByIdForUpdate(resolveMatchId(idOrSlug))
                .orElseThrow(() -> ApiException.notFound("Match", idOrSlug));
    }

    /** Resolve a match id from either the UUID (tried first) or the unique URL slug. 404 if neither. */
    private UUID resolveMatchId(String idOrSlug) {
        try {
            return UUID.fromString(idOrSlug);
        } catch (IllegalArgumentException notAUuid) {
            return matchRepository.findBySlug(idOrSlug).map(Match::getId)
                    .orElseThrow(() -> ApiException.notFound("Match", idOrSlug));
        }
    }

    /**
     * True when the match belongs to a season that has already been FINISHED. Such a match is part of the
     * frozen historical standings, so voiding it (cancel/delete) is refused — the recompute engine no
     * longer touches finished-season franchise points, so a void would silently leave the frozen snapshot
     * and all-time table over-crediting the fixture. Voiding stays available for ACTIVE-season fixtures
     * (the rematch / unfair-result case).
     */
    private boolean belongsToFinishedSeason(Match match) {
        String code = match.getSeasonId();
        if (code == null || code.isBlank()) {
            return false;
        }
        return seasonRepository.findByCodeIgnoreCase(code)
                .map(s -> s.getStatus() == SeasonStatus.FINISHED)
                .orElse(false);
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

    private MatchSummary toSummary(Match match, Map<UUID, List<MatchParticipant>> participantsByMatch) {
        List<String> participantTags = participantsByMatch.getOrDefault(match.getId(), List.of()).stream()
                .map(MatchParticipant::getFranchise)
                .filter(f -> f != null)
                .map(Franchise::getTag)
                .toList();
        return new MatchSummary(
                match.getId().toString(),
                match.getSlug(),
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

    /** Configured hours before a match's scheduled start when its registration window closes. */
    private int registrationLockHours() {
        LeagueSettings s = leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID).orElse(null);
        return s != null ? Math.max(0, s.getRegistrationLockHours()) : 3;
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
                match.getSlug(),
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
                registrationLockHours(),
                participants
        );
    }

    private static GameMini toGameMini(Game game) {
        if (game == null) {
            return null;
        }
        return new GameMini(game.getId().toString(), game.getName(),
                game.getGameType() == null ? null : game.getGameType().name());
    }

    private static ResultView toResultView(ResultRow row) {
        Franchise franchise = row.getFranchise();
        if (franchise != null) {
            return new ResultView(
                    row.getRank(),
                    franchise.getId().toString(),
                    franchise.getName(),
                    franchise.getTag(),
                    row.getKills(),
                    row.getPlacePts(),
                    row.getTotal());
        }
        // FFA entrant: no franchise — surface the player's gamer tag in the name/tag slots (franchiseId
        // is left null so the row does not link to a non-existent franchise page).
        Player player = row.getPlayer();
        return new ResultView(
                row.getRank(),
                null,
                player == null ? null : player.getGamerTag(),
                player == null ? null : player.getGamerTag(),
                row.getKills(),
                row.getPlacePts(),
                row.getTotal());
    }
}
