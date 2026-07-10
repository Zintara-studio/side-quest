package com.sidequest.arena.matches.dto;

import jakarta.validation.constraints.Size;

/**
 * Body for {@code POST /matches/{id}/start} — take a fixture live and (optionally) set the room's
 * lobby code and venue. Both fields are optional.
 *
 * @param roomId the lobby / room code participants use to join (optional)
 * @param venue  the venue for the match; when supplied it updates the match arena (optional)
 */
public record StartMatchRequest(
        @Size(max = 120) String roomId,
        @Size(max = 200) String venue
) {
}
