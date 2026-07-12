package com.sidequest.arena.auctions;

import com.sidequest.arena.auctions.dto.AddFundsRequest;
import com.sidequest.arena.auctions.dto.AssignRequest;
import com.sidequest.arena.auctions.dto.AuctionView;
import com.sidequest.arena.auctions.dto.CreateAuctionRequest;
import com.sidequest.arena.auctions.dto.NominateRequest;
import com.sidequest.arena.auctions.dto.PlaceBidRequest;
import com.sidequest.arena.auctions.dto.ReAuctionRequest;
import com.sidequest.arena.auctions.dto.RescheduleRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auctions API. Reads are authenticated (any logged-in user can watch the board); lifecycle and
 * takeover actions are admin-only; bidding is limited to a participating franchise's owner/manager.
 * All mutations return the full {@link AuctionView} snapshot for the polling client.
 */
@RestController
@RequestMapping("/auctions")
public class AuctionController {

    private final AuctionService auctionService;

    public AuctionController(AuctionService auctionService) {
        this.auctionService = auctionService;
    }

    // ---- reads (authenticated) ----

    /** The single active auction (most recent DRAFT/LIVE/PAUSED); 200 with null body when none. */
    @GetMapping("/active")
    public AuctionView active() {
        return auctionService.activeAuction();
    }

    /** Full snapshot of one auction. */
    @GetMapping("/{id}")
    public AuctionView get(@PathVariable String id) {
        return auctionService.getAuction(id);
    }

    // ---- creation & lifecycle (admin) ----

    /** Create a DRAFT auction with participants and a lot pool (admin only). */
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<AuctionView> create(@Valid @RequestBody CreateAuctionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auctionService.create(request));
    }

    /** Edit auction config while DRAFT/LOBBY — base price, timers, raises, budget, participants (admin). */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView update(@PathVariable String id,
                             @Valid @RequestBody com.sidequest.arena.auctions.dto.UpdateAuctionRequest request) {
        return auctionService.updateConfig(id, request);
    }

    /** Freeze the registration pool (close auction sign-ups) — required before opening the hall (admin). */
    @PostMapping("/{id}/lock-pool")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView lockPool(@PathVariable String id) {
        return auctionService.lockPool(id);
    }

    /** DRAFT -> LOBBY: open the hall for participating franchises to join (admin only). */
    @PostMapping("/{id}/open-hall")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView openHall(@PathVariable String id) {
        return auctionService.openHall(id);
    }

    /**
     * Mark the caller's participating franchise present in the hall. Authorization is enforced in the
     * service against the live franchise ownership/management relationship (not the JWT role claim, which
     * can lag a mid-session manager promotion), so any authenticated user may reach it and non-leaders
     * get a clear 403.
     */
    @PostMapping("/{id}/join")
    @PreAuthorize("isAuthenticated()")
    public AuctionView join(@PathVariable String id) {
        return auctionService.join(id);
    }

    /** Set/change the scheduled go-live time and notify participants (admin only). */
    @PostMapping("/{id}/reschedule")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView reschedule(@PathVariable String id, @Valid @RequestBody RescheduleRequest request) {
        return auctionService.reschedule(id, request.scheduledAt());
    }

    /** LOBBY -> LIVE and nominate the first lot (admin only). */
    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView start(@PathVariable String id) {
        return auctionService.start(id);
    }

    /** LIVE -> PAUSED (admin only). */
    @PostMapping("/{id}/pause")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView pause(@PathVariable String id) {
        return auctionService.pause(id);
    }

    /** PAUSED -> LIVE (admin only). */
    @PostMapping("/{id}/resume")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView resume(@PathVariable String id) {
        return auctionService.resume(id);
    }

    /** Finalize the on-block lot now, then advance (admin only). */
    @PostMapping("/{id}/finalize")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView finalizeCurrent(@PathVariable String id) {
        return auctionService.finalizeCurrent(id);
    }

    /** Force the on-block lot UNSOLD, then advance (admin only). */
    @PostMapping("/{id}/unsold")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView markUnsold(@PathVariable String id) {
        return auctionService.markUnsold(id);
    }

    /** LIVE/PAUSED -> COMPLETED; remaining lots become UNSOLD (admin only). */
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView complete(@PathVariable String id) {
        return auctionService.complete(id);
    }

    /** DRAFT/LOBBY -> CANCELLED: call off an auction that never went live (admin only). */
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView cancel(@PathVariable String id) {
        return auctionService.cancel(id);
    }

    /** Put a specific queued lot on the block (admin only). */
    @PostMapping("/{id}/nominate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView nominate(@PathVariable String id, @Valid @RequestBody NominateRequest request) {
        return auctionService.nominate(id, request);
    }

    /** Force-sell a lot to a participant at a set price (admin only). */
    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView assign(@PathVariable String id, @Valid @RequestBody AssignRequest request) {
        return auctionService.assign(id, request);
    }

    /** Return a SOLD/UNSOLD lot to the queue (admin only). */
    @PostMapping("/{id}/reauction")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView reAuction(@PathVariable String id, @Valid @RequestBody ReAuctionRequest request) {
        return auctionService.reAuction(id, request);
    }

    /** Top up a participant's purse (admin only). */
    @PostMapping("/{id}/funds")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AuctionView addFunds(@PathVariable String id, @Valid @RequestBody AddFundsRequest request) {
        return auctionService.addFunds(id, request);
    }

    // ---- bidding (participating owner/manager) ----

    /**
     * Place a bid on the lot on the block. Like join, authorization is enforced in the service against
     * the live participating-franchise ownership/management relationship, so a freshly-promoted manager
     * whose token still says PLAYER can still bid and non-leaders get a clear 403.
     */
    @PostMapping("/{id}/bid")
    @PreAuthorize("isAuthenticated()")
    public AuctionView bid(@PathVariable String id, @Valid @RequestBody PlaceBidRequest request) {
        return auctionService.placeBid(id, request);
    }
}
