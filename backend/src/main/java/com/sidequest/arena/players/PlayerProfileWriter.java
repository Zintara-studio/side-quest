package com.sidequest.arena.players;

import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.model.PlayerGameUsername;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerGameUsernameRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Single canonical writer for a player's per-game skill + handle. Both auction registration
 * ({@code RegistrationService.apply}) and profile editing ({@code PlayerService.update}) route through
 * here so the two paths can never diverge.
 *
 * <p>Intentionally repository-backed only (never depends on another domain service) so it can be
 * injected into multiple services without forming a bean cycle — see the batch-6 bean-cycle note.
 */
@Component
public class PlayerProfileWriter {

    private final GameRepository gameRepository;
    private final PlayerGameProficiencyRepository proficiencyRepository;
    private final PlayerGameUsernameRepository usernameRepository;

    public PlayerProfileWriter(GameRepository gameRepository,
                               PlayerGameProficiencyRepository proficiencyRepository,
                               PlayerGameUsernameRepository usernameRepository) {
        this.gameRepository = gameRepository;
        this.proficiencyRepository = proficiencyRepository;
        this.usernameRepository = usernameRepository;
    }

    /**
     * One per-game upsert line.
     *
     * @param gameId       the game
     * @param rating       self-rated skill (clamped to 0–100)
     * @param handle       in-game handle; when non-blank the handle row is created/updated
     * @param handlePublic desired handle visibility; {@code null} preserves the current value (default
     *                     {@code true} on a freshly created handle row)
     * @param rankTier     objective rank/tier label; only overwritten when non-blank
     * @param kd           self-reported K/D; only overwritten when non-null
     * @param accountLevel self-reported account level; only overwritten when non-null
     */
    public record Upsert(UUID gameId, int rating, String handle, Boolean handlePublic,
                         String rankTier, Double kd, Integer accountLevel) {
    }

    /**
     * Create-or-update the player's {@link PlayerGameProficiency} (rating always written, clamped) and,
     * when a handle is supplied or a visibility change is requested, their {@link PlayerGameUsername}.
     * Objective signals (rankTier/kd/accountLevel) are only overwritten when supplied so a re-submit
     * can't wipe them. Unknown/blank games are skipped; no-op when {@code entries} is null/empty.
     */
    public void upsert(Player player, List<Upsert> entries) {
        if (entries == null || entries.isEmpty()) {
            return;
        }
        List<PlayerGameProficiency> ratings = proficiencyRepository.findByPlayerId(player.getId());
        List<PlayerGameUsername> handles = usernameRepository.findByPlayerId(player.getId());

        for (Upsert entry : entries) {
            if (entry == null || entry.gameId() == null) {
                continue;
            }
            Game game = gameRepository.findById(entry.gameId()).orElse(null);
            if (game == null) {
                continue;
            }

            PlayerGameProficiency prof = ratings.stream()
                    .filter(p -> p.getGame() != null && p.getGame().getId().equals(game.getId()))
                    .findFirst()
                    .orElse(null);
            if (prof == null) {
                prof = new PlayerGameProficiency();
                prof.setPlayer(player);
                prof.setGame(game);
                ratings.add(prof);
            }
            prof.setRating(Math.max(0, Math.min(100, entry.rating())));
            if (entry.rankTier() != null && !entry.rankTier().isBlank()) {
                prof.setRankTier(entry.rankTier().trim());
            }
            if (entry.kd() != null) {
                prof.setKd(Math.max(0, entry.kd()));
            }
            if (entry.accountLevel() != null) {
                prof.setAccountLevel(Math.max(0, entry.accountLevel()));
            }
            proficiencyRepository.save(prof);

            boolean hasHandle = entry.handle() != null && !entry.handle().isBlank();
            PlayerGameUsername row = handles.stream()
                    .filter(h -> h.getGame() != null && h.getGame().getId().equals(game.getId()))
                    .findFirst()
                    .orElse(null);
            if (hasHandle && row == null) {
                row = new PlayerGameUsername();
                row.setPlayer(player);
                row.setGame(game);
                row.setPublic(true);
                handles.add(row);
            }
            if (row != null && (hasHandle || entry.handlePublic() != null)) {
                if (hasHandle) {
                    row.setHandle(entry.handle().trim());
                }
                if (entry.handlePublic() != null) {
                    row.setPublic(entry.handlePublic());
                }
                usernameRepository.save(row);
            }
        }
    }
}
