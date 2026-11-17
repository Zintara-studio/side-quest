package com.sidequest.arena.auctions.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Admin takeover payload for {@code POST /auctions/:id/assign}: force-sell a lot to a participating
 * franchise at a set price (bypassing the bidding flow).
 */
public record AssignRequest(
        @NotBlank String lotId,
        @NotBlank String franchiseId,
        long price
) {
}
