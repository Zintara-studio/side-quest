package com.sidequest.arena.players.dto;

import java.util.List;

/**
 * Partial-update payload for {@code PATCH /players/{id}}. All fields are optional; only non-null fields
 * are applied to the profile (a blank string clears an editable text field). {@code proficiencies},
 * when present, upserts the player's per-game skill + handle through the shared profile writer.
 *
 * @param gamerTag           new public handle (nullable)
 * @param avatarUrl          new avatar url, e.g. {@code /media/{id}} (nullable)
 * @param region             new region (nullable)
 * @param bio                new bio (nullable)
 * @param realName           new real name (nullable)
 * @param phone              new contact phone (nullable)
 * @param contactEmail       new contact email (nullable)
 * @param realNamePublic     new real-name visibility (nullable → unchanged)
 * @param phonePublic        new phone visibility (nullable → unchanged)
 * @param contactEmailPublic new contact-email visibility (nullable → unchanged)
 * @param proficiencies      per-game skill/handle upserts (nullable → unchanged)
 */
public record UpdatePlayerRequest(
        String gamerTag,
        String avatarUrl,
        String region,
        String bio,
        String realName,
        String phone,
        String contactEmail,
        Boolean realNamePublic,
        Boolean phonePublic,
        Boolean contactEmailPublic,
        List<GameEntry> proficiencies
) {

    /**
     * A per-game edit line from the profile form. {@code gameId} is the game's string id; {@code rating}
     * is the 0–100 self-rating (clamped server-side); {@code handlePublic} toggles the handle's
     * visibility (nullable → unchanged).
     */
    public record GameEntry(
            String gameId,
            int rating,
            String handle,
            Boolean handlePublic,
            String rankTier,
            Double kd,
            Integer accountLevel
    ) {
    }
}
