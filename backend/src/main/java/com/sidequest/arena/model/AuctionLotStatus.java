package com.sidequest.arena.model;

/**
 * State of a single player {@link AuctionLot} within an auction:
 * <ul>
 *   <li>{@code QUEUED} — waiting in the pool to be nominated;</li>
 *   <li>{@code ON_BLOCK} — currently up for bidding (at most one per auction);</li>
 *   <li>{@code SOLD} — won by a franchise and attached to its roster;</li>
 *   <li>{@code UNSOLD} — passed with no winning bid.</li>
 * </ul>
 */
public enum AuctionLotStatus {
    QUEUED,
    ON_BLOCK,
    SOLD,
    UNSOLD
}
