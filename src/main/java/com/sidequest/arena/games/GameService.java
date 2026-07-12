package com.sidequest.arena.games;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.security.SecurityUtils;
import com.sidequest.arena.games.dto.CreateGameRequest;
import com.sidequest.arena.games.dto.GameDetail;
import com.sidequest.arena.games.dto.GameMatchView;
import com.sidequest.arena.games.dto.GameSummary;
import com.sidequest.arena.games.dto.UpdateGameRequest;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.scoring.ScoringService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Read/admin operations over the supported-titles catalogue: listing games with popularity,
 * fetching a single title with its recent matches, and applying admin patches with audit logging.
 */
@Service
public class GameService {

    private final GameRepository gameRepository;
    private final MatchRepository matchRepository;
    private final ScoringService scoringService;
    private final AuditService auditService;

    public GameService(GameRepository gameRepository,
                       MatchRepository matchRepository,
                       ScoringService scoringService,
                       AuditService auditService) {
        this.gameRepository = gameRepository;
        this.matchRepository = matchRepository;
        this.scoringService = scoringService;
        this.auditService = auditService;
    }

    /**
     * Lists supported titles ordered by popularity (desc). When {@code enabled} is {@code true} only
     * enabled titles are returned; otherwise all titles are returned. This catalogue is small, so no
     * pagination is applied.
     */
    @Cacheable(CacheConfig.GAMES)
    @Transactional(readOnly = true)
    public List<GameSummary> list(Boolean enabled) {
        List<Game> games = Boolean.TRUE.equals(enabled)
                ? gameRepository.findByEnabledTrueOrderByPopularityDesc()
                : gameRepository.findAllByOrderByPopularityDesc();
        return games.stream().map(GameService::toSummary).toList();
    }

    /** Fetches a title with its recent matches (newest first). 404 if the game does not exist. */
    @Transactional(readOnly = true)
    public GameDetail get(UUID id) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Game", id));
        return toDetail(game);
    }

    /**
     * Admin: add a new title. The name must be free (case-insensitive); scoring defaults from the genre
     * (tune later via {@link #update}). Audited; evicts the games cache. 409 on a duplicate name.
     */
    @CacheEvict(value = CacheConfig.GAMES, allEntries = true)
    @Transactional
    public GameDetail create(CreateGameRequest req) {
        String name = req.name().trim();
        if (gameRepository.existsByNameIgnoreCase(name)) {
            throw ApiException.conflict("A game named \"" + name + "\" already exists.");
        }
        Game game = GameCatalogSeeder.buildGame(name, req.format().trim(), req.gameType(),
                req.popularity() != null ? req.popularity() : 0, true);
        if (req.iconUrl() != null && !req.iconUrl().isBlank()) {
            game.setIconUrl(req.iconUrl().trim());
        }
        Game saved = gameRepository.save(game);
        auditService.record("game.create", "Game", saved.getId().toString(), saved.getName());
        return toDetail(saved);
    }

    /**
     * Applies the non-null fields of {@code request} to the game, persists the change, records an
     * audit entry summarising what changed, and returns the refreshed detail. 404 if not found.
     */
    @CacheEvict(value = CacheConfig.GAMES, allEntries = true)
    @Transactional
    public GameDetail update(UUID id, UpdateGameRequest request) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Game", id));

        List<String> changes = new ArrayList<>();
        if (request.enabled() != null) {
            game.setEnabled(request.enabled());
            changes.add("enabled=" + request.enabled());
        }
        if (request.popularity() != null) {
            game.setPopularity(request.popularity());
            changes.add("popularity=" + request.popularity());
        }
        if (request.format() != null) {
            game.setFormat(request.format());
            changes.add("format=" + request.format());
        }
        if (request.iconUrl() != null) {
            game.setIconUrl(request.iconUrl());
            changes.add("iconUrl=" + request.iconUrl());
        }
        if (request.gameType() != null) {
            game.setGameType(request.gameType());
            changes.add("gameType=" + request.gameType());
        }
        if (request.pointsPerKill() != null) {
            game.setPointsPerKill(Math.max(0, request.pointsPerKill()));
            changes.add("pointsPerKill=" + game.getPointsPerKill());
        }
        if (request.placementPoints() != null) {
            game.setPlacementPoints(normalizePlacementPoints(request.placementPoints()));
            changes.add("placementPoints=" + game.getPlacementPoints());
        }
        boolean weightChanged = false;
        if (request.standingsWeight() != null) {
            int newWeight = Math.max(0, request.standingsWeight());
            weightChanged = newWeight != game.getStandingsWeight();
            // Standings weight re-weights the whole live table — a sensitive, main-admin-only lever.
            // Regular admins may still edit every other game field; only a weight *change* is gated.
            if (weightChanged && !SecurityUtils.isSuperAdmin()) {
                throw ApiException.forbidden("Only the main admin can change a game's standings weight");
            }
            game.setStandingsWeight(newWeight);
            changes.add("standingsWeight=" + newWeight);
        }

        Game saved = gameRepository.save(game);

        // A changed standings weight re-weights this title's matches in the LIVE current-season table.
        // Season-scoped + snapshot-preserving, so finished seasons are never altered.
        if (weightChanged) {
            scoringService.recomputeStandings();
        }

        String summary = changes.isEmpty() ? "no changes" : String.join(", ", changes);
        auditService.record("game.update", "Game", id.toString(), summary);

        return toDetail(saved);
    }

    /** Validate + normalize a placement-points ladder: blank → "", else comma-separated integers. */
    private static String normalizePlacementPoints(String raw) {
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        String[] parts = trimmed.split(",", -1);
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            String p = part.trim();
            try {
                Integer.parseInt(p);
            } catch (NumberFormatException ex) {
                throw ApiException.badRequest(
                        "placementPoints must be a comma-separated list of integers; bad entry: '" + part + "'");
            }
            if (out.length() > 0) {
                out.append(",");
            }
            out.append(p);
        }
        return out.toString();
    }

    // ---- mappers ----

    private static GameSummary toSummary(Game game) {
        return new GameSummary(
                game.getId().toString(),
                game.getName(),
                game.getFormat(),
                game.getGameType().name(),
                game.getIconUrl(),
                game.isEnabled(),
                game.getPopularity(),
                game.getPointsPerKill(),
                game.getPlacementPoints(),
                game.getStandingsWeight()
        );
    }

    private GameDetail toDetail(Game game) {
        List<GameMatchView> matches = matchRepository
                .findByGameIdOrderByScheduledAtDesc(game.getId())
                .stream()
                .map(GameService::toMatchView)
                .toList();
        return new GameDetail(
                game.getId().toString(),
                game.getName(),
                game.getFormat(),
                game.getGameType().name(),
                game.getIconUrl(),
                game.isEnabled(),
                game.getPopularity(),
                game.getPointsPerKill(),
                game.getPlacementPoints(),
                game.getStandingsWeight(),
                matches
        );
    }

    private static GameMatchView toMatchView(Match match) {
        return new GameMatchView(
                match.getId().toString(),
                match.getScheduledAt(),
                match.getStatus() == null ? null : match.getStatus().name(),
                match.getArena()
        );
    }
}
