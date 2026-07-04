package com.sidequest.arena.repo;

import com.sidequest.arena.model.AuctionLot;
import com.sidequest.arena.model.AuctionLotStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuctionLotRepository extends JpaRepository<AuctionLot, UUID> {

    List<AuctionLot> findByAuctionIdOrderByLotOrderAsc(UUID auctionId);

    List<AuctionLot> findByAuctionIdAndStatus(UUID auctionId, AuctionLotStatus status);

    /** The single lot currently on the block for an auction. */
    Optional<AuctionLot> findFirstByAuctionIdAndStatus(UUID auctionId, AuctionLotStatus status);

    /** The next lot to nominate (lowest lotOrder in the given status). */
    Optional<AuctionLot> findFirstByAuctionIdAndStatusOrderByLotOrderAsc(UUID auctionId, AuctionLotStatus status);
}
