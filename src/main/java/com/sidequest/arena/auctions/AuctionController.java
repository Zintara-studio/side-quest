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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AuctionView> create(@Valid @RequestBody CreateAuctionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auctionService.create(request));
    }

    /** Edit auction config while DRAFT/LOBBY — base price, timers, raises, budget, participants (admin). */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView update(@PathVariable String id,
                             @RequestBody com.sidequest.arena.auctions.dto.UpdateAuctionRequest request) {
        return auctionService.updateConfig(id, request);
    }

    /** DRAFT -> LOBBY: open the hall for participating franchises to join (admin only). */
    @PostMapping("/{id}/open-hall")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView openHall(@PathVariable String id) {
        return auctionService.openHall(id);
    }

    /** Mark the caller's participating franchise present in the hall (admin/franchise owner/manager). */
    @PostMapping("/{id}/join")
    @PreAuthorize("hasAnyRole('ADMIN','FRANCHISE_OWNER','FRANCHISE_MANAGER')")
    public AuctionView join(@PathVariable String id) {
        return auctionService.join(id);
    }

    /** Set/change the scheduled go-live time and notify participants (admin only). */
    @PostMapping("/{id}/reschedule")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView reschedule(@PathVariable String id, @Valid @RequestBody RescheduleRequest request) {
        return auctionService.reschedule(id, request.scheduledAt());
    }

    /** LOBBY -> LIVE and nominate the first lot (admin only). */
    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView start(@PathVariable String id) {
        return auctionService.start(id);
    }

    /** LIVE -> PAUSED (admin only). */
    @PostMapping("/{id}/pause")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView pause(@PathVariable String id) {
        return auctionService.pause(id);
    }

    /** PAUSED -> LIVE (admin only). */
    @PostMapping("/{id}/resume")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView resume(@PathVariable String id) {
        return auctionService.resume(id);
    }

    /** Finalize the on-block lot now, then advance (admin only). */
    @PostMapping("/{id}/finalize")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView finalizeCurrent(@PathVariable String id) {
        return auctionService.finalizeCurrent(id);
    }

    /** Force the on-block lot UNSOLD, then advance (admin only). */
    @PostMapping("/{id}/unsold")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView markUnsold(@PathVariable String id) {
        return auctionService.markUnsold(id);
    }

    /** LIVE/PAUSED -> COMPLETED; remaining lots become UNSOLD (admin only). */
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView complete(@PathVariable String id) {
        return auctionService.complete(id);
    }

    /** Put a specific queued lot on the block (admin only). */
    @PostMapping("/{id}/nominate")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView nominate(@PathVariable String id, @Valid @RequestBody NominateRequest request) {
        return auctionService.nominate(id, request);
    }

    /** Force-sell a lot to a participant at a set price (admin only). */
    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView assign(@PathVariable String id, @Valid @RequestBody AssignRequest request) {
        return auctionService.assign(id, request);
    }

    /** Return a SOLD/UNSOLD lot to the queue (admin only). */
    @PostMapping("/{id}/reauction")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView reAuction(@PathVariable String id, @Valid @RequestBody ReAuctionRequest request) {
        return auctionService.reAuction(id, request);
    }

    /** Top up a participant's purse (admin only). */
    @PostMapping("/{id}/funds")
    @PreAuthorize("hasRole('ADMIN')")
    public AuctionView addFunds(@PathVariable String id, @Valid @RequestBody AddFundsRequest request) {
        return auctionService.addFunds(id, request);
    }

    // ---- bidding (participating owner/manager) ----

    /** Place a bid on the lot on the block (admin/franchise owner/manager). */
    @PostMapping("/{id}/bid")
    @PreAuthorize("hasAnyRole('ADMIN','FRANCHISE_OWNER','FRANCHISE_MANAGER')")
    public AuctionView bid(@PathVariable String id, @Valid @RequestBody PlaceBidRequest request) {
        return auctionService.placeBid(id, request);
    }
}
