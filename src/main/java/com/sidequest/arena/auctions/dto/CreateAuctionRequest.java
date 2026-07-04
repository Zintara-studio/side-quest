package com.sidequest.arena.auctions.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * Admin payload for {@code POST /auctions}. Configures a new auction (in {@code DRAFT}), enrolls the
 * participating franchises (each starts with {@code defaultBudget}), and seeds the lot pool.
 *
 * @param participantFranchiseIds franchises taking part (each gets a purse of {@code defaultBudget})
 * @param playerIds               explicit lot pool; when empty the pool is drawn from non-rejected
 *                                {@code AUCTION}-type registrations
 * @param antiSnipeSeconds        anti-snipe cushion; defaults to 10 when null or &lt;= 0
 * @param raiseIncrements         allowed raise steps; defaults to {@code [10,50,100,200,500]} when empty
 */
public record CreateAuctionRequest(
        @NotBlank String title,
        String seasonId,
        long basePrice,
        int bidTimerSeconds,
        Integer antiSnipeSeconds,
        List<Integer> raiseIncrements,
        long defaultBudget,
        List<String> participantFranchiseIds,
        List<String> playerIds
) {
}
