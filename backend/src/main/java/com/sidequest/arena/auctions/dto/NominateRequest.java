package com.sidequest.arena.auctions.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Admin payload for {@code POST /auctions/:id/nominate}: put a specific queued lot on the block (only
 * valid when nothing is currently on the block).
 */
public record NominateRequest(
        @NotBlank String lotId
) {
}
