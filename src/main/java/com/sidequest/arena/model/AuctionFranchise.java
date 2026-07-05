package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * A {@link Franchise} participating in an {@link Auction} with its own purse. {@code budget} is the
 * original allotment; {@code balance} is what remains after wins are debited. The optimistic
 * {@code version} guards concurrent debits when two bids/finalizes race.
 */
@Entity
@Table(name = "auction_franchises", uniqueConstraints =
        @UniqueConstraint(name = "uk_auction_franchise", columnNames = {"auction_id", "franchise_id"}))
@Getter
@Setter
@NoArgsConstructor
public class AuctionFranchise extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "auction_id", nullable = false)
    private Auction auction;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;

    /** Original allotment for this auction. */
    @Column(nullable = false)
    private long budget;

    /** Remaining spendable balance (budget minus debited wins). */
    @Column(nullable = false)
    private long balance;

    /** Whether this franchise's leadership has joined the auction hall (present for bidding). */
    @Column(nullable = false)
    private boolean joined = false;

    /** When the franchise joined the hall (nullable until it joins). */
    @Column(name = "joined_at")
    private Instant joinedAt;

    @Version
    @Column(nullable = false)
    private long version;
}
