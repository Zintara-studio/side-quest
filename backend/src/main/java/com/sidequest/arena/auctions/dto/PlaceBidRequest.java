package com.sidequest.arena.auctions.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Owner/manager payload for {@code POST /auctions/:id/bid}: the lot being bid on (must be the one on
 * the block) and the bid amount.
 */
public record PlaceBidRequest(
        @NotBlank String lotId,
        long amount
) {
}
