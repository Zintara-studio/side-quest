package com.sidequest.arena.repo;

import com.sidequest.arena.model.AuctionFranchise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuctionFranchiseRepository extends JpaRepository<AuctionFranchise, UUID> {

    List<AuctionFranchise> findByAuctionId(UUID auctionId);

    Optional<AuctionFranchise> findByAuctionIdAndFranchiseId(UUID auctionId, UUID franchiseId);
}
