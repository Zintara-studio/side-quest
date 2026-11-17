package com.sidequest.arena.disputes.dto;

import com.sidequest.arena.model.DisputeCategory;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

/**
 * Payload for a user opening a dispute via {@code POST /disputes}.
 *
 * @param matchId  the disputed match, for RESULT disputes; {@code null} for APPEAL / GENERAL
 * @param reason   why the dispute is being raised (required)
 * @param category what the dispute is about; {@code null} defaults to {@link DisputeCategory#RESULT}
 */
public record CreateDisputeRequest(
        UUID matchId,
        @NotBlank(message = "reason is required to raise a dispute") String reason,
        DisputeCategory category
) {
}
