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
import com.sidequest.arena.model.GameType;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchLineup;
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
import com.sidequest.arena.repo.MatchLineupRepository;
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
import com.sidequest.arena.security.SecurityUtils;
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
    private final MatchLineupRepository matchLineupRepository;
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
                        MatchLineupRepository matchLineupRepository,
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
        this.matchLineupRepository = matchLineupRepository;
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
        match.setSeasonId(request.seasonId());
        // Seed scoring weights from the current league defaults; adjustable per match at result entry.
        LeagueSettings defaults = leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID).orElse(null);
        if (defaults != null) {
            match.setPointsPerKill(defaults.getPointsPerKill());
            match.setPlacementPoints(defaults.getPlacementPoints());
        }
        // Override the placement ladder from the game's genre: non-placement genres (TACTICAL/SPORTS/
        // FIGHTING) carry no ladder, so their fixtures score on kills/score alone; placement genres
        // (BATTLE_ROYALE/PARTY) keep the ladder seeded above (falling back to the genre default when the
        // league seeded none). pointsPerKill stays as-is (1) so kills/score are weighted uniformly.
        GameType gameType = game.getGameType();
        if (gameType != null && !gameType.usesPlacement()) {
            match.setPlacementPoints("");
        } else if (gameType != null && (match.getPlacementPoints() == null
                || match.getPlacementPoints().isBlank())) {
            match.setPlacementPoints(gameType.defaultPlacementPoints());
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
            // A player can appear in more than one live registration for the same match; emit once.
            // Live = registered and not discarded (FORMING/ACTIVE/LOCKED); the confirmed roster is
            // whoever accepted, so pending/expired invites are ignored below.
            java.util.Set<UUID> seen = new java.util.HashSet<>();
            for (Registration reg : registrationRepository.findByMatchId(match.getId())) {
                RegistrationStatus st = reg.getStatus();
                if (st != RegistrationStatus.FORMING && st != RegistrationStatus.ACTIVE
                        && st != RegistrationStatus.LOCKED) {
                    continue;
                }
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
                // A franchise that has set a per-match lineup fields exactly those players; otherwise
                // fall back to the full roster.
                List<MatchLineup> lineup = matchLineupRepository
                        .findByMatchIdAndFranchiseId(match.getId(), f.getId());
                if (!lineup.isEmpty()) {
                    for (MatchLineup ml : lineup) {
                        Player p = ml.getPlayer();
                        if (p == null) {
                            continue;
                        }
                        out.add(new MatchPlayerView(p.getId().toString(), p.getGamerTag(),
                                f.getId().toString(), f.getTag(), null));
                    }
                } else {
                    for (Player p : playerRepository.findByFranchiseId(f.getId())) {
                        out.add(new MatchPlayerView(p.getId().toString(), p.getGamerTag(),
                                f.getId().toString(), f.getTag(), null));
                    }
                }
            }
        }
        return out;
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
