package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A pre-season player auction. Participating franchises bid on players (one {@link AuctionLot} on the
 * block at a time); a scheduled sweep auto-finalizes the block when its bid timer expires and advances
 * to the next queued lot. Configuration (base price, timers, raise increments, default budget) is
 * captured up front and is server-authoritative.
 */
@Entity
@Table(name = "auctions")
@Getter
@Setter
@NoArgsConstructor
public class Auction extends BaseEntity {

    @Column(nullable = false)
    private String title;

    /** Season the auction feeds (nullable — a standalone auction is allowed). */
    @Column(name = "season_id")
    private String seasonId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AuctionStatus status = AuctionStatus.DRAFT;

    /** Opening bid required for the first bid on any lot. */
    @Column(name = "base_price", nullable = false)
    private long basePrice;

    /** Seconds on the countdown; a bid resets the block's deadline to now + this. */
    @Column(name = "bid_timer_seconds", nullable = false)
    private int bidTimerSeconds;

    /** Anti-snipe cushion (seconds) carried in config for the client countdown. */
    @Column(name = "anti_snipe_seconds", nullable = false)
    private int antiSnipeSeconds = 10;

    /** Allowed raise steps as a CSV, e.g. {@code "10,50,100,200,500"}; smallest is the min raise. */
    @Column(name = "raise_increments", nullable = false)
    private String raiseIncrements = "10,50,100,200,500";

    /** Budget (and starting balance) every participating franchise begins with. */
    @Column(name = "default_budget", nullable = false)
    private long defaultBudget;

    /** When the auction is scheduled to go live (nullable — unscheduled or on-demand). */
    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    /** Downtime (seconds) after a lot is finalized before the next lot is nominated. */
    @Column(name = "intermission_seconds", nullable = false)
    private int intermissionSeconds = 4;

    /**
     * While set (and in the future) the auction is between lots — the sweep waits until this passes
     * before nominating the next queued lot. {@code null} when not in an intermission.
     */
    @Column(name = "intermission_until")
    private Instant intermissionUntil;

    /**
     * Set when the admin freezes the registration pool (locking in the final set of pooled players)
     * before the hall opens. While non-null the pool no longer syncs new registrants and auction
     * registration is closed. {@code null} = pool still open.
     */
    @Column(name = "pool_locked_at")
    private Instant poolLockedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;
}
