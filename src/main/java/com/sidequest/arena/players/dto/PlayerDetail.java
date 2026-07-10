package com.sidequest.arena.players.dto;

import java.util.List;

/**
 * Full player profile for {@code GET /players/{id}}. The owning user is exposed only by display name
 * (the login email is never surfaced).
 *
 * <p>The contact fields ({@code realName}, {@code phone}, {@code contactEmail}) are per-field private:
 * each is {@code null} for a viewer who may not see it. A viewer may see a private field when they are
 * the profile owner, an admin, or an owner/manager of the profile's franchise. The matching
 * {@code *Public} flags reflect the owner's toggle (so the edit UI can render current state) and are
 * safe to expose.
 *
 * @param id                 player id
 * @param gamerTag           public handle
 * @param avatarUrl          avatar image url (nullable)
 * @param region             player region (nullable)
 * @param bio                free-text bio (nullable)
 * @param realName           real name, or {@code null} when hidden from this viewer
 * @param phone              contact phone, or {@code null} when hidden from this viewer
 * @param contactEmail       contact email, or {@code null} when hidden from this viewer
 * @param realNamePublic     whether the real name is publicly visible
 * @param phonePublic        whether the phone is publicly visible
 * @param contactEmailPublic whether the contact email is publicly visible
 * @param status             {@link com.sidequest.arena.model.PlayerStatus} name
 * @param points             accumulated leaderboard points
 * @param user               minimal owning-user view
 * @param franchise          owning franchise, or {@code null} if unassigned
 * @param proficiencies      the player's per-game proficiency ratings
 */
public record PlayerDetail(
        String id,
        String gamerTag,
        String avatarUrl,
        String region,
        String bio,
        String realName,
        String phone,
        String contactEmail,
        boolean realNamePublic,
        boolean phonePublic,
        boolean contactEmailPublic,
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
