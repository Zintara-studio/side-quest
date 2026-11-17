package com.sidequest.arena.games;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.games.dto.GameSummary;
import com.sidequest.arena.games.dto.GameVotesView;
import com.sidequest.arena.games.dto.SaveVotesRequest;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.GameVote;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.GameVoteRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Community game-popularity voting. Any signed-in user upvotes the games they like; each game's
 * {@code popularity} is then derived as {@code round(100 * distinct voters for that game / distinct
 * voters overall)} (0 when nobody has voted). Admins no longer set popularity by hand — it is fully
 * vote-driven.
 *
 * <p><b>Concurrency &amp; idempotency.</b> A save uses PUT semantics — it replaces the caller's entire
 * vote set — so re-saving the same selection is a no-op for the result. Because popularity is a pure
 * function of the committed vote rows, the recompute is idempotent. To keep two simultaneous voters
 * from racing, the vote-save-plus-recompute runs inside an app-level lock held <i>across the commit</i>
 * (via {@link TransactionTemplate}): the next voter's recompute therefore always reads the previous
 * voter's committed votes, so popularity converges to the correct value. (Single-instance guarantee;
 * a multi-node deployment would swap the local lock for a DB advisory lock — this app runs one node.)
 */
@Service
public class GameVoteService {

    private final GameVoteRepository gameVoteRepository;
    private final GameRepository gameRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate txTemplate;

    /** Serializes the whole save+recompute (including its commit) so concurrent votes can't race. */
    private final ReentrantLock recomputeLock = new ReentrantLock();

    public GameVoteService(GameVoteRepository gameVoteRepository,
                           GameRepository gameRepository,
                           UserRepository userRepository,
                           PlatformTransactionManager txManager) {
        this.gameVoteRepository = gameVoteRepository;
        this.gameRepository = gameRepository;
        this.userRepository = userRepository;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    /** The games the current (signed-in) user has upvoted, so the vote UI can pre-select them. */
    @Transactional(readOnly = true)
    public GameVotesView myVotes() {
        UUID userId = SecurityUtils.currentUserId();
        List<String> ids = gameVoteRepository.findByUserId(userId).stream()
                .map(v -> v.getGame().getId().toString())
                .toList();
        return new GameVotesView(ids);
    }

    /**
     * Replace the caller's vote set with {@code req.gameIds()} (unknown/duplicate ids ignored), then
     * recompute every game's popularity and return the refreshed catalogue. Serialized across its commit
     * so concurrent voters can't clobber each other.
     */
    @CacheEvict(value = CacheConfig.GAMES, allEntries = true)
    public List<GameSummary> saveVotes(SaveVotesRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        // Resolve requested ids to real, distinct games up front (outside the lock).
        Set<UUID> wanted = new LinkedHashSet<>();
        if (req.gameIds() != null) {
            for (String raw : req.gameIds()) {
                try {
                    wanted.add(UUID.fromString(raw));
                } catch (IllegalArgumentException ignoreUnknownId) {
                    // A non-UUID / stale id is silently dropped — the save is best-effort over real games.
                }
            }
        }
        recomputeLock.lock();
        try {
            return txTemplate.execute(status -> {
                User user = userRepository.findById(userId)
                        .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Authentication required"));
                List<Game> games = wanted.isEmpty() ? List.of() : gameRepository.findAllById(wanted);
                // Replace the user's whole set: clear then re-insert. Flush the delete before inserts so
                // the (user, game) unique constraint can't trip on a re-vote for the same game.
                gameVoteRepository.deleteByUserId(user.getId());
                gameVoteRepository.flush();
                for (Game g : games) {
                    gameVoteRepository.save(new GameVote(user, g));
                }
                gameVoteRepository.flush();
                doRecompute();
                return gameRepository.findAllByOrderByPopularityDesc().stream()
                        .map(GameService::toSummary)
                        .toList();
            });
        } finally {
            recomputeLock.unlock();
        }
    }

    /**
     * Recompute every game's popularity from the current votes. Exposed for the seeder / tests; the
     * live save path recomputes inline. Serialized across its commit like {@link #saveVotes}.
     */
    @CacheEvict(value = CacheConfig.GAMES, allEntries = true)
    public void recomputeAllPopularity() {
        recomputeLock.lock();
        try {
            txTemplate.executeWithoutResult(status -> doRecompute());
        } finally {
            recomputeLock.unlock();
        }
    }

    /**
     * The pure recompute: popularity = round(100 * distinct game voters / distinct total voters), 0 when
     * nobody has voted. Must run inside a transaction with the recompute lock held (callers guarantee
     * both). Only writes games whose popularity actually changed, to keep it cheap and audit-quiet.
     */
    private void doRecompute() {
        long totalVoters = gameVoteRepository.countDistinctVoters();
        Map<UUID, Long> votesByGame = new HashMap<>();
        for (Object[] row : gameVoteRepository.countVotesPerGame()) {
            votesByGame.put((UUID) row[0], (Long) row[1]);
        }
        for (Game game : gameRepository.findAll()) {
            long votes = votesByGame.getOrDefault(game.getId(), 0L);
            int popularity = totalVoters == 0 ? 0 : (int) Math.round(100.0 * votes / totalVoters);
            if (game.getPopularity() != popularity) {
                game.setPopularity(popularity);
                gameRepository.save(game);
            }
        }
    }
}
