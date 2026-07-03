package com.sidequest.arena.standings;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.standings.dto.GameRankRow;
import com.sidequest.arena.standings.dto.PlayerRankRow;
import com.sidequest.arena.standings.dto.StandingRow;
import com.sidequest.arena.standings.dto.StandingsResponse;
import com.sidequest.arena.config.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Read-only standings and leaderboards: the franchise league table, the global player leaderboard,
 * and per-title proficiency rankings. Ranks are computed from the already-sorted repository
 * orderings, so positions are 1-based and stable within a request.
 */
@Service
public class StandingsService {

    private final FranchiseRepository franchiseRepository;
    private final PlayerRepository playerRepository;
    private final GameRepository gameRepository;
    private final PlayerGameProficiencyRepository playerGameProficiencyRepository;
    private final LeagueSettingsRepository leagueSettingsRepository;

    public StandingsService(FranchiseRepository franchiseRepository,
                            PlayerRepository playerRepository,
                            GameRepository gameRepository,
                            PlayerGameProficiencyRepository playerGameProficiencyRepository,
                            LeagueSettingsRepository leagueSettingsRepository) {
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.gameRepository = gameRepository;
        this.playerGameProficiencyRepository = playerGameProficiencyRepository;
        this.leagueSettingsRepository = leagueSettingsRepository;
    }

    /**
     * The franchise league table, ordered by points (desc) then name (asc). The season is taken
     * from the leading franchise's {@code seasonId}, falling back to the league's currently
     * configured season (from {@link LeagueSettings}) when there are no franchises.
     */
    @Cacheable(CacheConfig.STANDINGS)
    @Transactional(readOnly = true)
    public StandingsResponse standings() {
        List<Franchise> franchises = franchiseRepository.findAllByOrderByPointsDescNameAsc();

        String season = franchises.isEmpty() ? currentSeasonCode() : franchises.get(0).getSeasonId();
        if (season == null) {
            season = currentSeasonCode();
        }

        List<StandingRow> rows = new ArrayList<>(franchises.size());
        int rank = 1;
        for (Franchise f : franchises) {
            rows.add(new StandingRow(
                    rank++,
                    f.getId().toString(),
                    f.getName(),
                    f.getTag(),
                    f.getPoints(),
                    f.isActive()));
        }
        return new StandingsResponse(season, rows);
    }

    /**
     * The global player leaderboard, ordered by points (desc), capped at {@code limit} players.
     * {@code limit} is clamped to the standard pagination bounds; a player's franchise tag is
     * {@code null} when they are unassigned.
     */
    @Cacheable(CacheConfig.LEADERBOARD_PLAYERS)
    @Transactional(readOnly = true)
    public List<PlayerRankRow> topPlayers(Integer limit) {
        int cap = Cursors.clampLimit(limit);
        List<Player> players = playerRepository.findAllByOrderByPointsDesc();

        List<PlayerRankRow> rows = new ArrayList<>();
        int rank = 1;
        for (Player p : players) {
            if (rows.size() >= cap) {
                break;
            }
            String franchiseTag = p.getFranchise() != null ? p.getFranchise().getTag() : null;
            rows.add(new PlayerRankRow(
                    rank++,
                    p.getId().toString(),
                    p.getGamerTag(),
                    p.getAvatarUrl(),
                    p.getPoints(),
                    franchiseTag));
        }
        return rows;
    }

    /**
     * Per-title rankings for a game, ordered by self-rated proficiency (desc). 404 if the game does
     * not exist (an unparseable id can never match).
     */
    @Cacheable(value = CacheConfig.GAME_RANKINGS, key = "#gameId")
    @Transactional(readOnly = true)
    public List<GameRankRow> gameRankings(String gameId) {
        Game game = gameRepository.findById(parseId(gameId, "Game"))
                .orElseThrow(() -> ApiException.notFound("Game", gameId));

        List<PlayerGameProficiency> proficiencies =
                playerGameProficiencyRepository.findByGameId(game.getId());

        List<PlayerGameProficiency> sorted = proficiencies.stream()
                .sorted(Comparator.comparingInt(PlayerGameProficiency::getRating).reversed())
                .toList();

        List<GameRankRow> rows = new ArrayList<>(sorted.size());
        int rank = 1;
        for (PlayerGameProficiency prof : sorted) {
            Player player = prof.getPlayer();
            rows.add(new GameRankRow(
                    rank++,
                    player != null ? player.getId().toString() : null,
                    player != null ? player.getGamerTag() : null,
                    prof.getRating()));
        }
        return rows;
    }

    /**
     * The league's currently configured season code, read dynamically from {@link LeagueSettings}
     * (repointed whenever an admin starts a new season). Used as the season label when there are no
     * franchises to derive it from. Returns {@code null} only if settings are somehow absent.
     */
    private String currentSeasonCode() {
        return leagueSettingsRepository.findById(LeagueSettings.SINGLETON_ID)
                .map(LeagueSettings::getSeasonId)
                .orElse(null);
    }

    /** Parse a string id to UUID; an unparseable id can never match, so report it as not found. */
    private static UUID parseId(String id, String resource) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound(resource, id);
        }
    }
}
