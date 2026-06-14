package com.sidequest.arena.games;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.games.dto.GameDetail;
import com.sidequest.arena.games.dto.GameMatchView;
import com.sidequest.arena.games.dto.GameSummary;
import com.sidequest.arena.games.dto.UpdateGameRequest;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.MatchRepository;
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
    private final AuditService auditService;

    public GameService(GameRepository gameRepository,
                       MatchRepository matchRepository,
                       AuditService auditService) {
        this.gameRepository = gameRepository;
        this.matchRepository = matchRepository;
        this.auditService = auditService;
    }

    /**
     * Lists supported titles ordered by popularity (desc). When {@code enabled} is {@code true} only
     * enabled titles are returned; otherwise all titles are returned. This catalogue is small, so no
     * pagination is applied.
     */
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
     * Applies the non-null fields of {@code request} to the game, persists the change, records an
     * audit entry summarising what changed, and returns the refreshed detail. 404 if not found.
     */
    @Transactional
    public GameDetail update(UUID id, UpdateGameRequest request) {
        Game game = gameRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Game", id));

        List<String> changes = new ArrayList<>();
        if (request.enabled() != null) {
            game.setEnabled(request.enabled());
            changes.add("enabled=" + request.enabled());
        }
        if (request.regOpen() != null) {
            game.setRegOpen(request.regOpen());
            changes.add("regOpen=" + request.regOpen());
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

        Game saved = gameRepository.save(game);

        String summary = changes.isEmpty() ? "no changes" : String.join(", ", changes);
        auditService.record("game.update", "Game", id.toString(), summary);

        return toDetail(saved);
    }

    // ---- mappers ----

    private static GameSummary toSummary(Game game) {
        return new GameSummary(
                game.getId().toString(),
                game.getName(),
                game.getFormat(),
                game.getIconUrl(),
                game.isEnabled(),
                game.isRegOpen(),
                game.getPopularity()
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
                game.getIconUrl(),
                game.isEnabled(),
                game.isRegOpen(),
                game.getPopularity(),
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
