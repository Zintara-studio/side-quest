package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One player up for auction. Exactly one lot per auction is {@code ON_BLOCK} at a time; the countdown
 * ({@code bidDeadline}) drives the auto-finalize sweep. On sale the player attaches to
 * {@code soldTo}'s franchise roster. The optimistic {@code version} guards racing bids/finalizes.
 */
@Entity
@Table(name = "auction_lots", uniqueConstraints =
        @UniqueConstraint(name = "uk_auction_player", columnNames = {"auction_id", "player_id"}))
@Getter
@Setter
@NoArgsConstructor
public class AuctionLot extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "auction_id", nullable = false)
    private Auction auction;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AuctionLotStatus status = AuctionLotStatus.QUEUED;

    /** The current top bid amount (0 until the first bid). */
    @Column(name = "current_bid", nullable = false)
    private long currentBid = 0;

    /** The current top bidder, or {@code null} when no bid has been placed yet. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_bidder_id")
    private AuctionFranchise currentBidder;

    /** The winning participant once {@code SOLD}, else {@code null}. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sold_to_id")
    private AuctionFranchise soldTo;

    /** Final hammer price once {@code SOLD}. */
    @Column(name = "sold_price", nullable = false)
    private long soldPrice = 0;

    /**
     * When bidding opens on this lot — the "review window" after nomination during which franchises can
     * study the player but can't bid yet. {@code null} when not on the block or the window has passed.
     */
    @Column(name = "bid_opens_at")
    private Instant bidOpensAt;

    /** When the current on-block countdown expires; {@code null} when not on the block. */
    @Column(name = "bid_deadline")
    private Instant bidDeadline;

    /** Position of this lot in the auction queue. */
    @Column(name = "lot_order", nullable = false)
    private int lotOrder;

    @Version
    @Column(nullable = false)
    private long version;
}
