package com.sidequest.arena.registrations.dto;

import com.sidequest.arena.model.RegistrationType;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Request body for {@code POST /registrations} — a player, squad, franchise or auction application.
 * For SQUAD and FRANCHISE applications {@code squadName} must additionally be non-blank (validated in
 * the service); AUCTION and PLAYER applications need no name.
 *
 * @param type          registration type (PLAYER, SQUAD, FRANCHISE or AUCTION), required
 * @param squadName     proposed squad/franchise name (required for SQUAD/FRANCHISE), nullable otherwise
 * @param games         game titles being registered for, at least one required
 * @param contact       free-form contact (whatsapp/discord), nullable
 * @param matchId       the FFA match this entry is for, when the call was tied to a match, nullable
 * @param gameId        explicit game hint for the registration; usually derived from the linked match,
 *                      so only needed for season/general calls with no match, nullable
 * @param proficiencies optional per-game self-rating + in-game handle, upserted onto the player's
 *                      profile (used by AUCTION entries so franchises can scout the pool), nullable
 * @param note          optional free-form note stored on the registration for admins, nullable
 * @param teamSize      desired squad size for a SQUAD registration (caps invites); nullable → default
 */
public record ApplyRequest(
        @NotNull RegistrationType type,
        String squadName,
        @NotEmpty List<String> games,
        String contact,
        String matchId,
        UUID gameId,
        List<ProficiencyEntry> proficiencies,
        String note,
        Integer teamSize
) {

    /**
     * A single per-game proficiency line: the game, a self-rated skill (accepted raw and clamped to
     * 0–100), and an optional in-game handle (made public when non-blank).
     *
     * @param gameId the game this rating/handle is for
     * @param rating self-rated skill on a 0–100 scale (clamped server-side)
     * @param handle in-game username for this game, made public when non-blank, nullable
     */
    public record ProficiencyEntry(UUID gameId, int rating, String handle) {
    }
}
