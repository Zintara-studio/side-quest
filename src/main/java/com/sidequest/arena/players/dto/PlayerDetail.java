package com.sidequest.arena.players.dto;

import java.util.List;

/**
 * Full public player profile for {@code GET /players/{id}}. The owning user is exposed only by
 * display name (email is never surfaced publicly).
 *
 * @param id            player id
 * @param gamerTag      public handle
 * @param avatarUrl     avatar image url (nullable)
 * @param region        player region (nullable)
 * @param bio           free-text bio (nullable)
 * @param status        {@link com.sidequest.arena.model.PlayerStatus} name
 * @param points        accumulated leaderboard points
 * @param user          minimal owning-user view
 * @param franchise     owning franchise, or {@code null} if unassigned
 * @param proficiencies the player's per-game proficiency ratings
 */
public record PlayerDetail(
        String id,
        String gamerTag,
        String avatarUrl,
        String region,
        String bio,
        String status,
        int points,
        UserMini user,
        FranchiseMini franchise,
        List<ProficiencyView> proficiencies
) {

    /** Minimal owning-user view; intentionally omits email and other PII. */
    public record UserMini(String name) {
    }

    /** Minimal franchise reference. */
    public record FranchiseMini(String id, String name, String tag) {
    }

    /** A player's self-rated proficiency for one game, plus optional objective signals. */
    public record ProficiencyView(String gameId, String gameName, int rating,
                                  String rankTier, Double kd, Integer accountLevel) {
    }
}
