package com.sidequest.arena.repo;

import com.sidequest.arena.model.Auction;
import com.sidequest.arena.model.AuctionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuctionRepository extends JpaRepository<Auction, UUID> {

    List<Auction> findByStatus(AuctionStatus status);

    /** The single "active" auction — most recent DRAFT/PAUSED/LIVE. */
    Optional<Auction> findFirstByStatusInOrderByCreatedAtDesc(Collection<AuctionStatus> statuses);

    /** True when a non-completed auction has its pool locked — i.e. auction registration is closed. */
    boolean existsByPoolLockedAtIsNotNullAndStatusNot(AuctionStatus status);
}
