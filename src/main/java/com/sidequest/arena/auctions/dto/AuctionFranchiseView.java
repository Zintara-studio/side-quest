package com.sidequest.arena.auctions.dto;

/**
 * A participating franchise's purse and haul within an auction.
 *
 * @param franchiseId   real franchise id (join key for lot bidder/winner ids)
 * @param name          franchise name
 * @param tag           franchise tag
 * @param budget        original allotment for this auction
 * @param balance       remaining spendable balance
 * @param acquiredCount number of players won so far
 */
public record AuctionFranchiseView(
        String franchiseId,
        String name,
        String tag,
        long budget,
        long balance,
        int acquiredCount
) {
}
