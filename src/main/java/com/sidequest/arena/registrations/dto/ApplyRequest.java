package com.sidequest.arena.registrations.dto;

import com.sidequest.arena.model.RegistrationType;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Request body for {@code POST /registrations} — a player or squad applying to the league.
 * For SQUAD applications {@code squadName} must additionally be non-blank (validated in the
 * service).
 *
 * @param type      registration type (PLAYER, SQUAD or FRANCHISE), required
 * @param squadName proposed squad/franchise name (required when {@code type != PLAYER}), nullable otherwise
 * @param games     game titles being registered for, at least one required
 * @param contact   free-form contact (whatsapp/discord), nullable
 * @param matchId   the FFA match this entry is for, when the call was tied to a match, nullable
 */
public record ApplyRequest(
        @NotNull RegistrationType type,
        String squadName,
        @NotEmpty List<String> games,
        String contact,
        String matchId
) {
}
