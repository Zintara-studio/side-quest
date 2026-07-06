package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An append-only ledger entry: one accepted bid on an {@link AuctionLot} by an {@link AuctionFranchise}.
 * Records feed the live bid feed and the audit trail; entries are never mutated.
 */
@Entity
@Table(name = "auction_bids", indexes =
        @Index(name = "idx_auction_bids_lot", columnList = "lot_id"))
@Getter
@Setter
@NoArgsConstructor
public class AuctionBid extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lot_id", nullable = false)
    private AuctionLot lot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bidder_id", nullable = false)
    private AuctionFranchise bidder;

    /** The user who placed the bid (owner/manager), or {@code null} for a system/admin action. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "placed_by")
    private User placedBy;

    @Column(nullable = false)
    private long amount;
}
