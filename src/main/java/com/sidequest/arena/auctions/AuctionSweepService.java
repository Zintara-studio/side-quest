package com.sidequest.arena.auctions;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The auction auto-advance clock. Once per second it asks {@link AuctionService} to finalize any
 * on-block lot whose bid timer has expired (selling to the top bidder or marking it UNSOLD) and to
 * advance the queue. Wrapped in a try/catch so a transient failure never kills the scheduler.
 */
@Component
public class AuctionSweepService {

    private static final Logger log = LoggerFactory.getLogger(AuctionSweepService.class);

    private final AuctionService auctionService;

    public AuctionSweepService(AuctionService auctionService) {
        this.auctionService = auctionService;
    }

    @Scheduled(fixedDelay = 1000)
    public void sweep() {
        try {
            auctionService.finalizeExpiredLots();
        } catch (Exception ex) {
            log.warn("Auction sweep failed", ex);
        }
    }
}
