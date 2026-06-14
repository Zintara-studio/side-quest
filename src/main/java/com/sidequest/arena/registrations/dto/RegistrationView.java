package com.sidequest.arena.registrations.dto;

import java.time.Instant;
import java.util.List;

/**
 * Response view for a registration / league application. Used by the apply endpoint and the
 * admin approval queue + detail/review endpoints.
 *
 * @param id         registration id
 * @param type       {@link com.sidequest.arena.model.RegistrationType} name
 * @param player     minimal applicant view, or {@code null} if no player is attached
 * @param squadName  proposed squad name (SQUAD applications), nullable
 * @param games      game titles the applicant registered for
 * @param contact    free-form contact captured at apply time, nullable
 * @param status     {@link com.sidequest.arena.model.RegistrationStatus} name
 * @param reviewedBy display name of the reviewing admin, or {@code null} if not yet reviewed
 * @param reason     rejection reason or approval note, nullable
 * @param createdAt  when the application was submitted
 */
public record RegistrationView(
        String id,
        String type,
        PlayerMini player,
        String squadName,
        List<String> games,
        String contact,
        String status,
        String reviewedBy,
        String reason,
        Instant createdAt
) {

    /** Minimal applicant-player reference. */
    public record PlayerMini(String id, String gamerTag) {
    }
}
