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
 * @param type      registration type (PLAYER or SQUAD), required
 * @param squadName proposed squad name (required when {@code type == SQUAD}), nullable otherwise
 * @param games     game titles being registered for, at least one required
 * @param contact   free-form contact (whatsapp/discord), nullable
 */
public record ApplyRequest(
        @NotNull RegistrationType type,
        String squadName,
        @NotEmpty List<String> games,
        String contact
) {
}
