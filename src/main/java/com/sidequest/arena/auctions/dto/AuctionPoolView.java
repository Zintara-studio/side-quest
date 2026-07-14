package com.sidequest.arena.auctions.dto;

import java.util.List;

/**
 * The standing auction pool, exposed independently of any {@link com.sidequest.arena.model.Auction}
 * entity so players can scout who has registered even before the league schedules an auction. Each
 * pooled player is projected into the same {@link AuctionLotView} shape the live board uses (status
 * {@code QUEUED}, bid fields zeroed) so the client can render them with its existing lot card.
 *
 * @param count           number of players currently in the pool
 * @param auctionActive   whether a live/scheduled auction already exists (the board takes over then)
 * @param players         the pooled players, in registration order (newest first)
 */
public record AuctionPoolView(
        int count,
        boolean auctionActive,
        List<AuctionLotView> players
) {
}
