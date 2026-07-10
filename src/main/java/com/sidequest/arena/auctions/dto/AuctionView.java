package com.sidequest.arena.auctions.dto;

import java.time.Instant;
import java.util.List;

/**
 * Full snapshot of an auction for the (polling) client. {@code serverTime} lets the client reconcile
 * its countdown against the authoritative clock, {@code currentLot} is the lot on the block (nullable),
 * and {@code franchises}/{@code lots}/{@code recentBids} carry the board state and live feed.
 *
 * @param id             auction id
 * @param title          auction title
 * @param seasonId       season the auction feeds (nullable)
 * @param status         {@code DRAFT} / {@code LOBBY} / {@code LIVE} / {@code PAUSED} / {@code COMPLETED}
 * @param poolLocked     whether the registration pool has been frozen (auction registration is closed)
 * @param basePrice      opening bid for the first bid on a lot
 * @param bidTimerSeconds countdown length; a bid resets the deadline to now + this
 * @param antiSnipeSeconds anti-snipe cushion (config; carried for the client)
 * @param raiseIncrements allowed raise steps (smallest is the min raise)
 * @param defaultBudget  starting purse each participant is given
 * @param intermissionSeconds the "sold" pause length between lots
 * @param scheduledAt    planned go-live time (nullable)
 * @param serverTime     authoritative server clock at snapshot time
 * @param intermissionUntil when set and in the future, the auction is between lots (nullable)
 * @param currentLot     the lot currently on the block, or {@code null}
 * @param franchises     participating franchises with purses and hauls
 * @param lots           every lot in queue order
 * @param recentBids     most recent bids across the auction (newest first)
 */
public record AuctionView(
        String id,
        String title,
        String seasonId,
        String status,
        boolean poolLocked,
        long basePrice,
        int bidTimerSeconds,
        int antiSnipeSeconds,
        List<Integer> raiseIncrements,
        long defaultBudget,
        int intermissionSeconds,
        Instant scheduledAt,
        Instant serverTime,
        Instant intermissionUntil,
        AuctionLotView currentLot,
        List<AuctionFranchiseView> franchises,
        List<AuctionLotView> lots,
        List<AuctionBidView> recentBids
) {
}
