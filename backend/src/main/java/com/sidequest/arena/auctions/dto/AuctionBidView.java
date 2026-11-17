package com.sidequest.arena.auctions.dto;

import java.time.Instant;

/**
 * A single entry in the live bid feed.
 *
 * @param lotId          the lot bid on
 * @param playerGamerTag the player's handle
 * @param franchiseTag   the bidding franchise's tag
 * @param amount         the bid amount
 * @param at             when the bid was placed
 */
public record AuctionBidView(
        String lotId,
        String playerGamerTag,
        String franchiseTag,
        long amount,
        Instant at
) {
}
