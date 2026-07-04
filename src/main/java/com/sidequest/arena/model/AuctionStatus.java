package com.sidequest.arena.model;

/**
 * Lifecycle of a pre-season {@link Auction}:
 * <ul>
 *   <li>{@code DRAFT} — configured but not yet running; participants and the lot pool are set up;</li>
 *   <li>{@code LIVE} — bidding is open and the sweep auto-advances the block;</li>
 *   <li>{@code PAUSED} — temporarily halted by an admin (the sweep skips it);</li>
 *   <li>{@code COMPLETED} — finished; no more lots on the block.</li>
 * </ul>
 */
public enum AuctionStatus {
    DRAFT,
    LIVE,
    PAUSED,
    COMPLETED
}
