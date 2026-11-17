package com.sidequest.arena.auctions.dto;

import java.time.Instant;
import java.util.List;

/**
 * Admin payload for {@code PATCH /auctions/:id} — edit an auction's configuration while it is still
 * {@code DRAFT} or {@code LOBBY} (before bidding goes live). Only non-null fields are applied. Changing
 * {@code defaultBudget} resets every participant's purse; changing {@code participantFranchiseIds}
 * adds/removes participants (each new one gets a purse of the current default budget).
 *
 * @param basePrice               opening bid required for the first bid on any lot
 * @param bidTimerSeconds         countdown reset on each bid
 * @param antiSnipeSeconds        anti-snipe cushion
 * @param raiseIncrements         allowed raise steps (smallest is the minimum raise)
 * @param defaultBudget           starting purse for every participant (resets balances when changed)
 * @param intermissionSeconds     "sold" pause between lots
 * @param scheduledAt             planned go-live time (nullable)
 * @param participantFranchiseIds the full set of participating franchises (replaces the current set)
 */
public record UpdateAuctionRequest(
        Long basePrice,
        Integer bidTimerSeconds,
        Integer antiSnipeSeconds,
        List<Integer> raiseIncrements,
        Long defaultBudget,
        Integer intermissionSeconds,
        Instant scheduledAt,
        List<String> participantFranchiseIds
) {
}
