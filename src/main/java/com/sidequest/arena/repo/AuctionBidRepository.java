package com.sidequest.arena.repo;

import com.sidequest.arena.model.AuctionBid;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuctionBidRepository extends JpaRepository<AuctionBid, UUID> {

    List<AuctionBid> findByLotIdOrderByCreatedAtDesc(UUID lotId);

    /** Recent bids across the whole auction, newest first, for the live feed. */
    List<AuctionBid> findTop25ByLot_Auction_IdOrderByCreatedAtDesc(UUID auctionId);
}
