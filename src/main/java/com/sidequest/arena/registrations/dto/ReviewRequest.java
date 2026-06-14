package com.sidequest.arena.registrations.dto;

/**
 * Request body for the admin review endpoints. Both fields are optional at the bind layer so the
 * single record can serve both approve and reject:
 * <ul>
 *   <li>approve — {@code note} is an optional approval note;</li>
 *   <li>reject — a non-blank reason is required (enforced in the service).</li>
 * </ul>
 *
 * @param note   optional approval note (approve)
 * @param reason rejection reason (reject — must be non-blank, validated in the service)
 */
public record ReviewRequest(
        String note,
        String reason
) {
}
