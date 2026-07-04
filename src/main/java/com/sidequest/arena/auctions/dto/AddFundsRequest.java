package com.sidequest.arena.auctions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * Admin payload for {@code POST /auctions/:id/funds}: top up a participating franchise's purse
 * (raises both its budget and its spendable balance).
 */
public record AddFundsRequest(
        @NotBlank String franchiseId,
        @Positive long amount
) {
}
