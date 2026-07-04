package com.sidequest.arena.auctions;

import com.sidequest.arena.auctions.dto.AddFundsRequest;
import com.sidequest.arena.auctions.dto.AssignRequest;
import com.sidequest.arena.auctions.dto.AuctionBidView;
import com.sidequest.arena.auctions.dto.AuctionFranchiseView;
import com.sidequest.arena.auctions.dto.AuctionLotView;
import com.sidequest.arena.auctions.dto.AuctionView;
import com.sidequest.arena.auctions.dto.CreateAuctionRequest;
import com.sidequest.arena.auctions.dto.NominateRequest;
import com.sidequest.arena.auctions.dto.PlaceBidRequest;
import com.sidequest.arena.auctions.dto.ReAuctionRequest;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.Auction;
import com.sidequest.arena.model.AuctionBid;
import com.sidequest.arena.model.AuctionFranchise;
import com.sidequest.arena.model.AuctionLot;
import com.sidequest.arena.model.AuctionLotStatus;
import com.sidequest.arena.model.AuctionStatus;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.User;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.realtime.RealtimeService;
import com.sidequest.arena.repo.AuctionBidRepository;
import com.sidequest.arena.repo.AuctionFranchiseRepository;
import com.sidequest.arena.repo.AuctionLotRepository;
import com.sidequest.arena.repo.AuctionRepository;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Server-authoritative pre-season player auction. Participating franchises bid, one player (lot) sits
 * on the block at a time behind a bid-timer countdown, and a scheduled sweep auto-finalizes the block
 * and advances the queue. Every mutating method takes a per-auction {@link ReentrantLock} and runs in
 * a transaction; the {@code @Version} fields on {@link AuctionLot}/{@link AuctionFranchise} are the
 * backstop against a racing writer that slips through the lock's commit window.
 */
@Service
public class AuctionService {

    private static final Logger log = LoggerFactory.getLogger(AuctionService.class);

    private static final String DEFAULT_INCREMENTS = "10,50,100,200,500";
    private static final int DEFAULT_ANTI_SNIPE = 10;
    private static final int DEFAULT_BID_TIMER = 30;

    private final AuctionRepository auctionRepository;
    private final AuctionFranchiseRepository auctionFranchiseRepository;
    private final AuctionLotRepository auctionLotRepository;
    private final AuctionBidRepository auctionBidRepository;
    private final FranchiseRepository franchiseRepository;
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;
    private final RegistrationRepository registrationRepository;
    private final NotificationService notificationService;
    private final RealtimeService realtimeService;

    /** Per-auction serialization: all mutations on a given auction run one at a time. */
    private final Map<UUID, ReentrantLock> locks = new ConcurrentHashMap<>();

    public AuctionService(AuctionRepository auctionRepository,
                          AuctionFranchiseRepository auctionFranchiseRepository,
                          AuctionLotRepository auctionLotRepository,
                          AuctionBidRepository auctionBidRepository,
                          FranchiseRepository franchiseRepository,
                          PlayerRepository playerRepository,
                          UserRepository userRepository,
                          RegistrationRepository registrationRepository,
                          NotificationService notificationService,
                          RealtimeService realtimeService) {
        this.auctionRepository = auctionRepository;
        this.auctionFranchiseRepository = auctionFranchiseRepository;
        this.auctionLotRepository = auctionLotRepository;
        this.auctionBidRepository = auctionBidRepository;
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.userRepository = userRepository;
        this.registrationRepository = registrationRepository;
        this.notificationService = notificationService;
        this.realtimeService = realtimeService;
    }

    private ReentrantLock lockFor(UUID auctionId) {
        return locks.computeIfAbsent(auctionId, k -> new ReentrantLock());
    }

    // ==== creation & reads =================================================

    /** Admin: create a DRAFT auction, enroll participants, and seed the lot pool. */
    @Transactional
    public AuctionView create(CreateAuctionRequest req) {
        Auction auction = new Auction();
        auction.setTitle(req.title());
        auction.setSeasonId(req.seasonId());
        auction.setStatus(AuctionStatus.DRAFT);
        auction.setBasePrice(req.basePrice());
        auction.setBidTimerSeconds(req.bidTimerSeconds() > 0 ? req.bidTimerSeconds() : DEFAULT_BID_TIMER);
        auction.setAntiSnipeSeconds(
                req.antiSnipeSeconds() == null || req.antiSnipeSeconds() <= 0
                        ? DEFAULT_ANTI_SNIPE : req.antiSnipeSeconds());
        auction.setRaiseIncrements(incrementsCsv(req.raiseIncrements()));
        auction.setDefaultBudget(req.defaultBudget());
        auction.setCreatedBy(currentUser());
        Auction saved = auctionRepository.save(auction);

        // Participants — one purse per franchise, starting balance == budget.
        if (req.participantFranchiseIds() != null) {
            for (String fid : req.participantFranchiseIds()) {
                Franchise franchise = requireFranchise(fid);
                AuctionFranchise af = new AuctionFranchise();
                af.setAuction(saved);
                af.setFranchise(franchise);
                af.setBudget(req.defaultBudget());
                af.setBalance(req.defaultBudget());
                auctionFranchiseRepository.save(af);
            }
        }

        // Lot pool — explicit players, else non-rejected AUCTION registrations.
        List<Player> pool = resolvePool(req);
        int order = 0;
        for (Player player : pool) {
            AuctionLot lot = new AuctionLot();
            lot.setAuction(saved);
            lot.setPlayer(player);
            lot.setStatus(AuctionLotStatus.QUEUED);
            lot.setCurrentBid(0);
            lot.setLotOrder(order++);
            auctionLotRepository.save(lot);
        }

        return viewOf(saved);
    }

    /** Read a single auction snapshot. */
    @Transactional(readOnly = true)
    public AuctionView getAuction(String id) {
        return viewOf(require(id));
    }

    /** The single "active" auction (most recent DRAFT/PAUSED/LIVE), or {@code null} when none. */
    @Transactional(readOnly = true)
    public AuctionView activeAuction() {
        Auction auction = auctionRepository.findFirstByStatusInOrderByCreatedAtDesc(
                List.of(AuctionStatus.DRAFT, AuctionStatus.LIVE, AuctionStatus.PAUSED)).orElse(null);
        return auction == null ? null : viewOf(auction);
    }

    // ==== lifecycle (admin) ================================================

    /** DRAFT -> LIVE and nominate the first queued lot. */
    @Transactional
    public AuctionView start(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.DRAFT) {
                throw ApiException.conflict("Only a DRAFT auction can be started");
            }
            AuctionLot first = auctionLotRepository
                    .findFirstByAuctionIdAndStatusOrderByLotOrderAsc(auction.getId(), AuctionLotStatus.QUEUED)
                    .orElseThrow(() -> ApiException.badRequest("No players in the pool"));
            auction.setStatus(AuctionStatus.LIVE);
            auctionRepository.save(auction);
            nominateLot(auction, first);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** LIVE -> PAUSED (the sweep skips paused auctions). */
    @Transactional
    public AuctionView pause(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LIVE) {
                throw ApiException.conflict("Only a LIVE auction can be paused");
            }
            auction.setStatus(AuctionStatus.PAUSED);
            auctionRepository.save(auction);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** PAUSED -> LIVE; refresh an expired on-block deadline so it does not instantly finalize. */
    @Transactional
    public AuctionView resume(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.PAUSED) {
                throw ApiException.conflict("Only a PAUSED auction can be resumed");
            }
            auction.setStatus(AuctionStatus.LIVE);
            auctionRepository.save(auction);
            AuctionLot onBlock = onBlock(auction);
            if (onBlock != null && onBlock.getBidDeadline() != null
                    && Instant.now().isAfter(onBlock.getBidDeadline())) {
                onBlock.setBidDeadline(Instant.now().plusSeconds(auction.getBidTimerSeconds()));
                auctionLotRepository.save(onBlock);
            }
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** LIVE/PAUSED -> COMPLETED; any remaining QUEUED/ON_BLOCK lots become UNSOLD. */
    @Transactional
    public AuctionView complete(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LIVE && auction.getStatus() != AuctionStatus.PAUSED) {
                throw ApiException.conflict("Only a LIVE or PAUSED auction can be completed");
            }
            for (AuctionLot lot : auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(auction.getId())) {
                if (lot.getStatus() == AuctionLotStatus.QUEUED
                        || lot.getStatus() == AuctionLotStatus.ON_BLOCK) {
                    lot.setStatus(AuctionLotStatus.UNSOLD);
                    lot.setBidDeadline(null);
                    auctionLotRepository.save(lot);
                }
            }
            auction.setStatus(AuctionStatus.COMPLETED);
            auctionRepository.save(auction);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    // ==== bidding ==========================================================

    /** Owner/manager: place a bid on the lot currently on the block. */
    @Transactional
    public AuctionView placeBid(String id, PlaceBidRequest req) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LIVE) {
                throw ApiException.conflict("Auction is not live");
            }
            AuctionLot lot = onBlock(auction);
            if (lot == null) {
                throw ApiException.conflict("No player is currently on the block");
            }
            if (!lot.getId().toString().equals(req.lotId())) {
                throw ApiException.conflict("That player is no longer on the block");
            }

            AuctionFranchise bidder = callerFranchise(auction.getId());
            long minNext = lot.getCurrentBidder() == null
                    ? auction.getBasePrice()
                    : lot.getCurrentBid() + smallestIncrement(auction);
            if (req.amount() < minNext) {
                throw ApiException.badRequest("Minimum bid is " + minNext);
            }
            if (req.amount() > bidder.getBalance()) {
                throw ApiException.badRequest("Insufficient balance");
            }
            if (lot.getCurrentBidder() != null && lot.getCurrentBidder().getId().equals(bidder.getId())) {
                throw ApiException.conflict("You are already the top bidder");
            }

            AuctionFranchise previous = lot.getCurrentBidder();
            lot.setCurrentBid(req.amount());
            lot.setCurrentBidder(bidder);
            lot.setBidDeadline(Instant.now().plusSeconds(auction.getBidTimerSeconds()));
            auctionLotRepository.save(lot);

            AuctionBid bid = new AuctionBid();
            bid.setLot(lot);
            bid.setBidder(bidder);
            bid.setPlacedBy(currentUser());
            bid.setAmount(req.amount());
            auctionBidRepository.save(bid);

            if (previous != null && !previous.getId().equals(bidder.getId())) {
                notifyOwner(auction, previous, "You were outbid",
                        bidder.getFranchise().getName() + " outbid you on "
                                + lot.getPlayer().getGamerTag() + " (" + req.amount() + ").");
            }
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    // ==== finalize / advance (admin + sweep) ===============================

    /** Admin: finalize the on-block lot now (sell to the top bidder or mark UNSOLD), then advance. */
    @Transactional
    public AuctionView finalizeCurrent(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LIVE) {
                throw ApiException.conflict("Auction is not live");
            }
            AuctionLot lot = onBlock(auction);
            if (lot == null) {
                throw ApiException.conflict("No player is currently on the block");
            }
            finalizeOnBlock(auction, lot);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Admin: force the on-block lot UNSOLD (ignore bids), then advance. */
    @Transactional
    public AuctionView markUnsold(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LIVE) {
                throw ApiException.conflict("Auction is not live");
            }
            AuctionLot lot = onBlock(auction);
            if (lot == null) {
                throw ApiException.conflict("No player is currently on the block");
            }
            lot.setStatus(AuctionLotStatus.UNSOLD);
            lot.setBidDeadline(null);
            auctionLotRepository.save(lot);
            advanceQueue(auction);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Admin: put a specific queued lot on the block (only when nothing is on the block). */
    @Transactional
    public AuctionView nominate(String id, NominateRequest req) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LIVE) {
                throw ApiException.conflict("Auction is not live");
            }
            if (onBlock(auction) != null) {
                throw ApiException.conflict("Finalize the current player first");
            }
            AuctionLot lot = requireLot(auction, req.lotId());
            if (lot.getStatus() != AuctionLotStatus.QUEUED) {
                throw ApiException.conflict("That lot is not queued");
            }
            nominateLot(auction, lot);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Admin takeover: force-sell a QUEUED/ON_BLOCK/UNSOLD lot to a participant at a set price. */
    @Transactional
    public AuctionView assign(String id, AssignRequest req) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            AuctionLot lot = requireLot(auction, req.lotId());
            if (lot.getStatus() == AuctionLotStatus.SOLD) {
                throw ApiException.conflict("Re-auction the player before reassigning");
            }
            AuctionFranchise winner = requireParticipant(auction, req.franchiseId());
            boolean wasOnBlock = lot.getStatus() == AuctionLotStatus.ON_BLOCK;

            sell(lot, winner, req.price());
            if (wasOnBlock) {
                advanceQueue(auction);
            }
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Admin: return a SOLD (refund + detach) or UNSOLD lot to the queue. */
    @Transactional
    public AuctionView reAuction(String id, ReAuctionRequest req) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            AuctionLot lot = requireLot(auction, req.lotId());
            if (lot.getStatus() == AuctionLotStatus.SOLD) {
                AuctionFranchise soldTo = lot.getSoldTo();
                if (soldTo != null) {
                    soldTo.setBalance(soldTo.getBalance() + lot.getSoldPrice());
                    auctionFranchiseRepository.save(soldTo);
                }
                Player player = lot.getPlayer();
                player.setFranchise(null);
                playerRepository.save(player);
            } else if (lot.getStatus() != AuctionLotStatus.UNSOLD) {
                throw ApiException.conflict("Only a SOLD or UNSOLD lot can be re-auctioned");
            }
            lot.setStatus(AuctionLotStatus.QUEUED);
            lot.setCurrentBid(0);
            lot.setCurrentBidder(null);
            lot.setSoldTo(null);
            lot.setSoldPrice(0);
            lot.setBidDeadline(null);
            auctionLotRepository.save(lot);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Admin: top up a participant's purse (raises both budget and balance). */
    @Transactional
    public AuctionView addFunds(String id, AddFundsRequest req) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (req.amount() <= 0) {
                throw ApiException.badRequest("Top-up amount must be positive");
            }
            AuctionFranchise af = requireParticipant(auction, req.franchiseId());
            af.setBudget(af.getBudget() + req.amount());
            af.setBalance(af.getBalance() + req.amount());
            auctionFranchiseRepository.save(af);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /**
     * The auto-advance engine, driven by {@link AuctionSweepService}. For every LIVE auction whose
     * on-block lot has an expired deadline, take the per-auction lock and finalize + advance. PAUSED
     * auctions are skipped. Runs in its own transaction (called from another bean, so the proxy
     * applies and the private helpers execute inside it).
     */
    @Transactional
    public void finalizeExpiredLots() {
        for (Auction candidate : auctionRepository.findByStatus(AuctionStatus.LIVE)) {
            AuctionLot lot = onBlock(candidate);
            if (lot == null || lot.getBidDeadline() == null
                    || !Instant.now().isAfter(lot.getBidDeadline())) {
                continue;
            }
            ReentrantLock lock = lockFor(candidate.getId());
            lock.lock();
            try {
                // Re-read fresh state under the lock — another writer may have moved things on.
                Auction auction = auctionRepository.findById(candidate.getId()).orElse(null);
                if (auction == null || auction.getStatus() != AuctionStatus.LIVE) {
                    continue;
                }
                AuctionLot fresh = onBlock(auction);
                if (fresh == null || fresh.getBidDeadline() == null
                        || !Instant.now().isAfter(fresh.getBidDeadline())) {
                    continue;
                }
                finalizeOnBlock(auction, fresh);
                publishSnapshot(auction);
            } finally {
                lock.unlock();
            }
        }
    }

    // ==== private helpers (run inside the locked + transactional context) ==

    /** Sell to the top bidder, else mark UNSOLD; then advance the queue. */
    private void finalizeOnBlock(Auction auction, AuctionLot lot) {
        if (lot.getCurrentBidder() != null) {
            sell(lot, lot.getCurrentBidder(), lot.getCurrentBid());
        } else {
            lot.setStatus(AuctionLotStatus.UNSOLD);
            lot.setBidDeadline(null);
            auctionLotRepository.save(lot);
        }
        advanceQueue(auction);
    }

    /** Mark a lot SOLD to a participant, debit their balance, attach the player, notify the owner. */
    private void sell(AuctionLot lot, AuctionFranchise winner, long price) {
        lot.setStatus(AuctionLotStatus.SOLD);
        lot.setSoldTo(winner);
        lot.setSoldPrice(price);
        lot.setCurrentBid(price);
        lot.setCurrentBidder(winner);
        lot.setBidDeadline(null);
        auctionLotRepository.save(lot);

        winner.setBalance(winner.getBalance() - price);
        auctionFranchiseRepository.save(winner);

        Player player = lot.getPlayer();
        player.setFranchise(winner.getFranchise());
        playerRepository.save(player);

        notifyOwner(lot.getAuction(), winner, "You won " + player.getGamerTag(),
                "You won " + player.getGamerTag() + " for " + price + ".");
    }

    /** Nominate the next queued lot, or complete the auction when the pool is exhausted. */
    private void advanceQueue(Auction auction) {
        AuctionLot next = auctionLotRepository
                .findFirstByAuctionIdAndStatusOrderByLotOrderAsc(auction.getId(), AuctionLotStatus.QUEUED)
                .orElse(null);
        if (next != null) {
            nominateLot(auction, next);
        } else {
            auction.setStatus(AuctionStatus.COMPLETED);
            auctionRepository.save(auction);
        }
    }

    /** Put a lot on the block with a fresh countdown and cleared bid state. */
    private void nominateLot(Auction auction, AuctionLot lot) {
        lot.setStatus(AuctionLotStatus.ON_BLOCK);
        lot.setCurrentBid(0);
        lot.setCurrentBidder(null);
        lot.setBidDeadline(Instant.now().plusSeconds(auction.getBidTimerSeconds()));
        auctionLotRepository.save(lot);
    }

    /** The lot currently on the block for an auction, or {@code null}. */
    private AuctionLot onBlock(Auction auction) {
        return auctionLotRepository
                .findFirstByAuctionIdAndStatus(auction.getId(), AuctionLotStatus.ON_BLOCK)
                .orElse(null);
    }

    /** Resolve the caller's participating franchise (owner or manager of it), else 403. */
    private AuctionFranchise callerFranchise(UUID auctionId) {
        UUID uid = SecurityUtils.currentUserId();
        return auctionFranchiseRepository.findByAuctionId(auctionId).stream()
                .filter(af -> ownedOrManagedBy(af.getFranchise(), uid))
                .findFirst()
                .orElseThrow(() -> ApiException.forbidden(
                        "Only a participating franchise owner/manager can bid"));
    }

    private static boolean ownedOrManagedBy(Franchise franchise, UUID userId) {
        return franchise != null
                && (matchesUser(franchise.getOwnerPlayer(), userId)
                || matchesUser(franchise.getManagerPlayer(), userId));
    }

    private static boolean matchesUser(Player player, UUID userId) {
        return player != null && player.getUser() != null && player.getUser().getId().equals(userId);
    }

    /** The players that seed the pool: explicit ids, else distinct non-rejected AUCTION registrants. */
    private List<Player> resolvePool(CreateAuctionRequest req) {
        if (req.playerIds() != null && !req.playerIds().isEmpty()) {
            List<Player> players = new ArrayList<>();
            for (String pid : req.playerIds()) {
                players.add(requirePlayer(pid));
            }
            return players;
        }
        Map<UUID, Player> distinct = new LinkedHashMap<>();
        for (Registration reg : registrationRepository
                .findByTypeOrderByCreatedAtDesc(RegistrationType.AUCTION)) {
            if (reg.getStatus() == RegistrationStatus.REJECTED) {
                continue;
            }
            Player player = reg.getPlayer();
            if (player != null) {
                distinct.putIfAbsent(player.getId(), player);
            }
        }
        return new ArrayList<>(distinct.values());
    }

    /** Notify a participant's franchise owner (best-effort — a missing owner/user is skipped). */
    private void notifyOwner(Auction auction, AuctionFranchise af, String title, String body) {
        Franchise franchise = af.getFranchise();
        if (franchise == null || franchise.getOwnerPlayer() == null
                || franchise.getOwnerPlayer().getUser() == null) {
            return;
        }
        notificationService.create(franchise.getOwnerPlayer().getUser(), NotificationType.AUCTION,
                title, body, "/auctions/" + auction.getId());
    }

    /** Smallest positive raise step configured for the auction (falls back to 1). */
    private long smallestIncrement(Auction auction) {
        long min = Long.MAX_VALUE;
        for (int inc : parseIncrements(auction.getRaiseIncrements())) {
            if (inc > 0 && inc < min) {
                min = inc;
            }
        }
        return min == Long.MAX_VALUE ? 1 : min;
    }

    private static String incrementsCsv(List<Integer> increments) {
        if (increments == null || increments.isEmpty()) {
            return DEFAULT_INCREMENTS;
        }
        StringBuilder sb = new StringBuilder();
        for (Integer inc : increments) {
            if (inc == null || inc <= 0) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(',');
            }
            sb.append(inc);
        }
        return sb.length() == 0 ? DEFAULT_INCREMENTS : sb.toString();
    }

    private static List<Integer> parseIncrements(String csv) {
        List<Integer> out = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                int value = Integer.parseInt(trimmed);
                if (value > 0) {
                    out.add(value);
                }
            } catch (NumberFormatException ignored) {
                // skip a malformed increment
            }
        }
        return out;
    }

    private User currentUser() {
        return userRepository.findById(SecurityUtils.currentUserId()).orElse(null);
    }

    // ==== view assembly ====================================================

    private AuctionView viewOf(Auction auction) {
        UUID aid = auction.getId();
        List<AuctionLot> lots = auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(aid);
        List<AuctionFranchise> participants = auctionFranchiseRepository.findByAuctionId(aid);

        Map<UUID, Integer> acquired = new java.util.HashMap<>();
        AuctionLot current = null;
        for (AuctionLot lot : lots) {
            if (lot.getStatus() == AuctionLotStatus.SOLD && lot.getSoldTo() != null) {
                acquired.merge(lot.getSoldTo().getId(), 1, Integer::sum);
            }
            if (lot.getStatus() == AuctionLotStatus.ON_BLOCK) {
                current = lot;
            }
        }

        List<AuctionFranchiseView> franchiseViews = new ArrayList<>();
        for (AuctionFranchise af : participants) {
            franchiseViews.add(franchiseView(af, acquired.getOrDefault(af.getId(), 0)));
        }
        List<AuctionLotView> lotViews = new ArrayList<>();
        for (AuctionLot lot : lots) {
            lotViews.add(lotView(lot, auction));
        }
        List<AuctionBidView> recentBids = new ArrayList<>();
        for (AuctionBid bid : auctionBidRepository.findTop25ByLot_Auction_IdOrderByCreatedAtDesc(aid)) {
            recentBids.add(bidView(bid));
        }

        return new AuctionView(
                aid.toString(),
                auction.getTitle(),
                auction.getSeasonId(),
                auction.getStatus().name(),
                auction.getBasePrice(),
                auction.getBidTimerSeconds(),
                auction.getAntiSnipeSeconds(),
                parseIncrements(auction.getRaiseIncrements()),
                Instant.now(),
                current == null ? null : lotView(current, auction),
                franchiseViews,
                lotViews,
                recentBids);
    }

    private AuctionLotView lotView(AuctionLot lot, Auction auction) {
        long minNext = lot.getCurrentBidder() == null
                ? auction.getBasePrice()
                : lot.getCurrentBid() + smallestIncrement(auction);
        Franchise bidder = lot.getCurrentBidder() == null ? null : lot.getCurrentBidder().getFranchise();
        Franchise soldTo = lot.getSoldTo() == null ? null : lot.getSoldTo().getFranchise();
        Player player = lot.getPlayer();
        return new AuctionLotView(
                lot.getId().toString(),
                player == null ? null : player.getId().toString(),
                player == null ? null : player.getGamerTag(),
                lot.getStatus().name(),
                lot.getCurrentBid(),
                minNext,
                bidder == null ? null : bidder.getId().toString(),
                bidder == null ? null : bidder.getTag(),
                soldTo == null ? null : soldTo.getId().toString(),
                soldTo == null ? null : soldTo.getTag(),
                lot.getSoldPrice(),
                lot.getBidDeadline(),
                lot.getLotOrder());
    }

    private static AuctionFranchiseView franchiseView(AuctionFranchise af, int acquiredCount) {
        Franchise franchise = af.getFranchise();
        return new AuctionFranchiseView(
                franchise == null ? null : franchise.getId().toString(),
                franchise == null ? null : franchise.getName(),
                franchise == null ? null : franchise.getTag(),
                af.getBudget(),
                af.getBalance(),
                acquiredCount);
    }

    private static AuctionBidView bidView(AuctionBid bid) {
        AuctionLot lot = bid.getLot();
        Player player = lot == null ? null : lot.getPlayer();
        Franchise franchise = bid.getBidder() == null ? null : bid.getBidder().getFranchise();
        return new AuctionBidView(
                lot == null ? null : lot.getId().toString(),
                player == null ? null : player.getGamerTag(),
                franchise == null ? null : franchise.getTag(),
                bid.getAmount(),
                bid.getCreatedAt());
    }

    /** Build the view, publish a best-effort realtime tick, and return it. */
    private AuctionView publishAndView(Auction auction) {
        AuctionView view = viewOf(auction);
        publish(auction.getId(), view);
        return view;
    }

    /** Publish a best-effort realtime snapshot (used by the sweep, which returns nothing). */
    private void publishSnapshot(Auction auction) {
        publish(auction.getId(), viewOf(auction));
    }

    private void publish(UUID auctionId, AuctionView view) {
        try {
            realtimeService.publishAuctionUpdate(auctionId, view);
        } catch (RuntimeException ex) {
            log.debug("Auction realtime publish failed for {}", auctionId, ex);
        }
    }

    // ==== id / lookup helpers ==============================================

    private Auction require(String id) {
        return auctionRepository.findById(parseId(id, "Auction"))
                .orElseThrow(() -> ApiException.notFound("Auction", id));
    }

    private Franchise requireFranchise(String id) {
        return franchiseRepository.findById(parseId(id, "Franchise"))
                .orElseThrow(() -> ApiException.notFound("Franchise", id));
    }

    private Player requirePlayer(String id) {
        return playerRepository.findById(parseId(id, "Player"))
                .orElseThrow(() -> ApiException.notFound("Player", id));
    }

    /** A lot by id that must belong to this auction. */
    private AuctionLot requireLot(Auction auction, String lotId) {
        AuctionLot lot = auctionLotRepository.findById(parseId(lotId, "AuctionLot"))
                .orElseThrow(() -> ApiException.notFound("AuctionLot", lotId));
        if (lot.getAuction() == null || !lot.getAuction().getId().equals(auction.getId())) {
            throw ApiException.notFound("AuctionLot", lotId);
        }
        return lot;
    }

    /** The participating franchise (by real franchise id) for this auction, else 400. */
    private AuctionFranchise requireParticipant(Auction auction, String franchiseId) {
        return auctionFranchiseRepository
                .findByAuctionIdAndFranchiseId(auction.getId(), parseId(franchiseId, "Franchise"))
                .orElseThrow(() -> ApiException.badRequest(
                        "Franchise is not a participant in this auction"));
    }

    private static UUID parseId(String id, String resource) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound(resource, id);
        }
    }
}
