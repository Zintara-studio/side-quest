package com.sidequest.arena.auctions.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Admin payload for {@code POST /auctions/:id/reauction}: return a SOLD (refund + detach) or UNSOLD
 * lot to the queue so it can be nominated again.
 */
public record ReAuctionRequest(
        @NotBlank String lotId
) {
}
