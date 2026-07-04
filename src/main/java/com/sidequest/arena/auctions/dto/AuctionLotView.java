package com.sidequest.arena.auctions.dto;

import java.time.Instant;

/**
 * A single auction lot as exposed to clients.
 *
 * @param id                       lot id
 * @param playerId                 the player up for auction
 * @param gamerTag                 the player's public handle
 * @param status                   {@code QUEUED} / {@code ON_BLOCK} / {@code SOLD} / {@code UNSOLD}
 * @param currentBid               current top bid (0 until first bid)
 * @param minNextBid               smallest amount the next bid may be
 * @param currentBidderFranchiseId real franchise id of the top bidder (nullable)
 * @param currentBidderTag         top bidder's franchise tag (nullable)
 * @param soldToFranchiseId        real franchise id of the winner once SOLD (nullable)
 * @param soldToTag                winner's franchise tag once SOLD (nullable)
 * @param soldPrice                final hammer price once SOLD (0 otherwise)
 * @param bidDeadline              when the on-block countdown expires (nullable when not on the block)
 * @param lotOrder                 position in the auction queue
 */
public record AuctionLotView(
        String id,
        String playerId,
        String gamerTag,
        String status,
        long currentBid,
        long minNextBid,
        String currentBidderFranchiseId,
        String currentBidderTag,
        String soldToFranchiseId,
        String soldToTag,
        long soldPrice,
        Instant bidDeadline,
        int lotOrder
) {
}
