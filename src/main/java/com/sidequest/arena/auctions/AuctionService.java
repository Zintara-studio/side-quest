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
import com.sidequest.arena.announcements.AnnouncementService;
import com.sidequest.arena.audit.AuditService;
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
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.model.PlayerGameUsername;
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
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerGameUsernameRepository;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

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
    private final PlayerGameProficiencyRepository proficiencyRepository;
    private final PlayerGameUsernameRepository usernameRepository;
    private final UserRepository userRepository;
    private final RegistrationRepository registrationRepository;
    private final NotificationService notificationService;
    private final RealtimeService realtimeService;
    private final AnnouncementService announcementService;
    private final AuditService auditService;

    /** Per-auction serialization: all mutations on a given auction run one at a time. */
    private final Map<UUID, ReentrantLock> locks = new ConcurrentHashMap<>();

    /**
     * Per-auction cache of each pooled player's STATIC scouting data (expertise, handles, declared games,
     * contact), keyed by playerId. Built once when the pool is frozen (the hall opens) — it can't change
     * after that — so the hot board poll serves it from memory instead of running per-lot queries. Evicted
     * on completion and rebuilt lazily if missing (e.g. after a restart).
     */
    private final Map<UUID, Map<UUID, ScoutData>> scoutCache = new ConcurrentHashMap<>();

    /** Static (non-bidding) scouting data for one pooled player; handle/contact are stripped per-viewer. */
    private record ScoutData(List<AuctionLotView.Expertise> expertise, List<String> games, String contact,
                             String realName) {
    }

    public AuctionService(AuctionRepository auctionRepository,
                          AuctionFranchiseRepository auctionFranchiseRepository,
                          AuctionLotRepository auctionLotRepository,
                          AuctionBidRepository auctionBidRepository,
                          FranchiseRepository franchiseRepository,
                          PlayerRepository playerRepository,
                          PlayerGameProficiencyRepository proficiencyRepository,
                          PlayerGameUsernameRepository usernameRepository,
                          UserRepository userRepository,
                          RegistrationRepository registrationRepository,
                          NotificationService notificationService,
                          RealtimeService realtimeService,
                          AnnouncementService announcementService,
                          AuditService auditService) {
        this.auctionRepository = auctionRepository;
        this.auctionFranchiseRepository = auctionFranchiseRepository;
        this.auctionLotRepository = auctionLotRepository;
        this.auctionBidRepository = auctionBidRepository;
        this.franchiseRepository = franchiseRepository;
        this.playerRepository = playerRepository;
        this.proficiencyRepository = proficiencyRepository;
        this.usernameRepository = usernameRepository;
        this.userRepository = userRepository;
        this.registrationRepository = registrationRepository;
        this.notificationService = notificationService;
        this.realtimeService = realtimeService;
        this.announcementService = announcementService;
        this.auditService = auditService;
    }

    /** Display name for a participant's franchise (audit detail). */
    private static String participantName(AuctionFranchise af) {
        Franchise f = af.getFranchise();
        return f != null ? f.getName() : "a franchise";
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
        auction.setScheduledAt(req.scheduledAt());
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

        // Lot pool — explicit players, else ACTIVE/unconsumed/un-rostered AUCTION registrations.
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

        // Nice-to-have: tell participating leadership when a scheduled time is set up front.
        if (saved.getScheduledAt() != null) {
            for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(saved.getId())) {
                notifyLeadership(af.getFranchise(), "Auction scheduled",
                        saved.getTitle() + " is scheduled for " + saved.getScheduledAt() + ".",
                        "/my/franchise/auction");
            }
        }

        return viewOf(saved);
    }

    /** Read a single auction snapshot. */
    @Transactional(readOnly = true)
    public AuctionView getAuction(String id) {
        return viewOf(require(id));
    }

    /** The single "active" auction (most recent DRAFT/LOBBY/PAUSED/LIVE), or {@code null} when none. */
    @Transactional(readOnly = true)
    public AuctionView activeAuction() {
        Auction auction = auctionRepository.findFirstByStatusInOrderByCreatedAtDesc(
                List.of(AuctionStatus.DRAFT, AuctionStatus.LOBBY, AuctionStatus.LIVE, AuctionStatus.PAUSED))
                .orElse(null);
        return auction == null ? null : viewOf(auction);
    }

    // ==== lifecycle (admin) ================================================

    /**
     * Freeze the registration pool: run one final sync so every current registrant is captured as a lot,
     * then stamp {@code poolLockedAt}. After this the pool no longer accepts new registrants (auction
     * registration is closed) and the hall can be opened. DRAFT only, and only once.
     *
     * <p>Locking also closes every open AUCTION registration call — the same effect as an admin closing
     * the announcement by hand — so the public Register button disappears instead of surviving to serve
     * a "pool is locked" error. The pool registrations themselves stay ACTIVE (they ARE the lot pool).
     */
    @Transactional
    public AuctionView lockPool(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.DRAFT) {
                throw ApiException.conflict("Only a DRAFT auction's pool can be locked");
            }
            if (auction.getPoolLockedAt() != null) {
                throw ApiException.conflict("The pool is already locked");
            }
            syncPoolInto(auction); // final capture of the standing registration pool
            auction.setPoolLockedAt(Instant.now());
            auctionRepository.save(auction);
            announcementService.closeAuctionCalls(); // registration is over — close the public call too
            auditService.record("auction.lockpool", "Auction", auction.getId().toString(),
                    "Pool locked for " + auction.getTitle());
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /**
     * DRAFT -> LOBBY: open the hall so participating franchises can join before bidding starts. The pool
     * must be locked first; opening the hall eagerly builds the static scouting map so the hot board poll
     * never has to.
     */
    @Transactional
    public AuctionView openHall(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.DRAFT) {
                throw ApiException.conflict("Only a DRAFT auction can open its hall");
            }
            if (auction.getPoolLockedAt() == null) {
                throw ApiException.conflict("Lock the pool before opening the hall");
            }
            auction.setStatus(AuctionStatus.LOBBY);
            auctionRepository.save(auction);
            // Eager-cache the (now frozen) scouting data so LIVE polling serves it from memory.
            scoutCache.put(auction.getId(), buildScoutMap(auction.getId()));
            for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(auction.getId())) {
                notifyLeadership(af.getFranchise(), "Auction hall is open",
                        "The hall for " + auction.getTitle() + " is open — join before bidding starts.",
                        "/my/franchise/auction");
            }
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Owner/manager: mark the caller's participating franchise present in the hall. */
    @Transactional
    public AuctionView join(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            // PAUSED counts as open: a pause is often precisely to wait for a missing franchise, so a
            // late-arriving owner must be able to join during it.
            if (auction.getStatus() != AuctionStatus.LOBBY && auction.getStatus() != AuctionStatus.LIVE
                    && auction.getStatus() != AuctionStatus.PAUSED) {
                throw ApiException.conflict("The hall is not open");
            }
            AuctionFranchise af = callerFranchise(auction.getId());
            af.setJoined(true);
            af.setJoinedAt(Instant.now());
            auctionFranchiseRepository.save(af);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** Admin: set/change the scheduled go-live time (DRAFT/LOBBY) and notify participating leadership. */
    @Transactional
    public AuctionView reschedule(String id, Instant scheduledAt) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.DRAFT && auction.getStatus() != AuctionStatus.LOBBY) {
                throw ApiException.conflict("Only a DRAFT or LOBBY auction can be rescheduled");
            }
            auction.setScheduledAt(scheduledAt);
            auctionRepository.save(auction);
            for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(auction.getId())) {
                notifyLeadership(af.getFranchise(), "Auction rescheduled",
                        auction.getTitle() + " is now scheduled for "
                                + (scheduledAt == null ? "an unspecified time" : scheduledAt) + ".",
                        "/my/franchise/auction");
            }
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Admin: edit auction configuration while it is still DRAFT or LOBBY (never once bidding is live).
     * Only non-null fields are applied. Changing {@code defaultBudget} resets every participant's purse
     * (nothing is spent before LIVE); changing the participant set adds/removes purses.
     */
    @Transactional
    public AuctionView updateConfig(String id, com.sidequest.arena.auctions.dto.UpdateAuctionRequest req) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.DRAFT && auction.getStatus() != AuctionStatus.LOBBY) {
                throw ApiException.conflict(
                        "Auction settings can only be changed before it goes live (DRAFT or LOBBY)");
            }
            if (req.basePrice() != null && req.basePrice() >= 0) {
                auction.setBasePrice(req.basePrice());
            }
            if (req.bidTimerSeconds() != null && req.bidTimerSeconds() > 0) {
                auction.setBidTimerSeconds(req.bidTimerSeconds());
            }
            if (req.antiSnipeSeconds() != null && req.antiSnipeSeconds() > 0) {
                auction.setAntiSnipeSeconds(req.antiSnipeSeconds());
            }
            if (req.intermissionSeconds() != null && req.intermissionSeconds() >= 0) {
                auction.setIntermissionSeconds(req.intermissionSeconds());
            }
            if (req.raiseIncrements() != null && !req.raiseIncrements().isEmpty()) {
                auction.setRaiseIncrements(incrementsCsv(req.raiseIncrements()));
            }
            if (req.scheduledAt() != null) {
                auction.setScheduledAt(req.scheduledAt());
            }
            // Budget change → reset every participant's purse (nothing is spent pre-LIVE).
            if (req.defaultBudget() != null && req.defaultBudget() > 0) {
                auction.setDefaultBudget(req.defaultBudget());
                for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(auction.getId())) {
                    af.setBudget(req.defaultBudget());
                    af.setBalance(req.defaultBudget());
                    auctionFranchiseRepository.save(af);
                }
            }
            // Participant set change → add new purses, drop removed franchises.
            if (req.participantFranchiseIds() != null) {
                long budget = auction.getDefaultBudget();
                java.util.Map<UUID, Franchise> wanted = new java.util.LinkedHashMap<>();
                for (String fid : req.participantFranchiseIds()) {
                    Franchise f = requireFranchise(fid);
                    wanted.put(f.getId(), f);
                }
                java.util.Set<UUID> have = new java.util.HashSet<>();
                for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(auction.getId())) {
                    UUID fid = af.getFranchise().getId();
                    have.add(fid);
                    if (!wanted.containsKey(fid)) {
                        auctionFranchiseRepository.delete(af);
                    }
                }
                for (Franchise f : wanted.values()) {
                    if (!have.contains(f.getId())) {
                        AuctionFranchise af = new AuctionFranchise();
                        af.setAuction(auction);
                        af.setFranchise(f);
                        af.setBudget(budget);
                        af.setBalance(budget);
                        auctionFranchiseRepository.save(af);
                    }
                }
            }
            auctionRepository.save(auction);
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /** LOBBY -> LIVE and nominate the first queued lot. */
    @Transactional
    public AuctionView start(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.LOBBY) {
                throw ApiException.conflict("Only a LOBBY auction can be started (open the hall first)");
            }
            // Bidding must not begin until the scouting map is built (built at open-hall; rebuilt here if
            // it was lost, e.g. a restart between opening the hall and starting).
            scoutCache.computeIfAbsent(auction.getId(), this::buildScoutMap);
            AuctionLot first = auctionLotRepository
                    .findFirstByAuctionIdAndStatusOrderByLotOrderAsc(auction.getId(), AuctionLotStatus.QUEUED)
                    .orElseThrow(() -> ApiException.badRequest("No players in the pool"));
            auction.setStatus(AuctionStatus.LIVE);
            auctionRepository.save(auction);
            nominateLot(auction, first);
            auditService.record("auction.start", "Auction", auction.getId().toString(),
                    "Bidding started for " + auction.getTitle());
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
            auditService.record("auction.pause", "Auction", auction.getId().toString(),
                    auction.getTitle() + " paused");
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
            // If a deadline or intermission elapsed while paused, push it forward so nothing instantly fires.
            if (auction.getIntermissionUntil() != null
                    && Instant.now().isAfter(auction.getIntermissionUntil())) {
                auction.setIntermissionUntil(Instant.now().plusSeconds(auction.getIntermissionSeconds()));
            }
            auctionRepository.save(auction);
            AuctionLot onBlock = onBlock(auction);
            if (onBlock != null && onBlock.getBidDeadline() != null
                    && Instant.now().isAfter(onBlock.getBidDeadline())) {
                onBlock.setBidDeadline(Instant.now().plusSeconds(auction.getBidTimerSeconds()));
                auctionLotRepository.save(onBlock);
            }
            auditService.record("auction.resume", "Auction", auction.getId().toString(),
                    auction.getTitle() + " resumed");
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Restart recovery, invoked once at boot (before the sweep's first tick): a LIVE auction whose
     * on-block bid deadline or intermission expired while the server was DOWN must not be instantly
     * finalized by the first sweep — nobody could bid during the outage. Mirrors {@link #resume}'s
     * forgiveness: push the elapsed deadlines forward and let bidding continue.
     */
    @Transactional
    public void recoverLiveDeadlinesAfterRestart() {
        for (Auction auction : auctionRepository.findByStatus(AuctionStatus.LIVE)) {
            ReentrantLock lock = lockFor(auction.getId());
            lock.lock();
            try {
                boolean touched = false;
                if (auction.getIntermissionUntil() != null
                        && Instant.now().isAfter(auction.getIntermissionUntil())) {
                    auction.setIntermissionUntil(Instant.now().plusSeconds(auction.getIntermissionSeconds()));
                    auctionRepository.save(auction);
                    touched = true;
                }
                AuctionLot onBlock = onBlock(auction);
                if (onBlock != null && onBlock.getBidDeadline() != null
                        && Instant.now().isAfter(onBlock.getBidDeadline())) {
                    onBlock.setBidDeadline(Instant.now().plusSeconds(auction.getBidTimerSeconds()));
                    auctionLotRepository.save(onBlock);
                    touched = true;
                }
                if (touched) {
                    log.info("Recovered live auction {} after restart — expired deadlines pushed forward",
                            auction.getId());
                    publishSnapshot(auction);
                }
            } finally {
                lock.unlock();
            }
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
            auction.setIntermissionUntil(null);
            auctionRepository.save(auction);
            scoutCache.remove(auction.getId()); // auction's done — drop its cached scouting map
            consumeAuctionPool();
            notifyAuctionSummary(auction);
            notifyAuctionPlayers(auction);
            auditService.record("auction.complete", "Auction", auction.getId().toString(),
                    auction.getTitle() + " completed");
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /**
     * Admin: call off an auction that never went live (DRAFT/LOBBY). Without this, a mistakenly created
     * DRAFT is the site-wide "active" auction forever — banner, lobby and admin CTA included. The pool
     * registrations are untouched (still ACTIVE and unconsumed), so they feed the next auction's pool
     * sync; participating leadership is told the event is off.
     */
    @Transactional
    public AuctionView cancel(String id) {
        ReentrantLock lock = lockFor(parseId(id, "Auction"));
        lock.lock();
        try {
            Auction auction = require(id);
            if (auction.getStatus() != AuctionStatus.DRAFT && auction.getStatus() != AuctionStatus.LOBBY) {
                throw ApiException.conflict(
                        "Only a DRAFT or LOBBY auction can be cancelled — pause/complete a live one instead");
            }
            auction.setStatus(AuctionStatus.CANCELLED);
            auction.setIntermissionUntil(null);
            auctionRepository.save(auction);
            scoutCache.remove(auction.getId());
            for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(auction.getId())) {
                notifyLeadership(af.getFranchise(), "Auction cancelled",
                        auction.getTitle() + " was called off. Pool registrations carry over to the next auction.",
                        "/my/franchise/auction");
            }
            auditService.record("auction.cancel", "Auction", auction.getId().toString(),
                    auction.getTitle() + " cancelled");
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
            if (lot.getBidOpensAt() != null && Instant.now().isBefore(lot.getBidOpensAt())) {
                long secs = java.time.Duration.between(Instant.now(), lot.getBidOpensAt()).toSeconds() + 1;
                throw ApiException.badRequest("Bidding opens in " + secs + "s — review the player first");
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

            // Per-event "outbid" pings are gone — a single summary is sent when the auction completes.
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
            // Assignment is a LIVE-auction takeover — outside LIVE/PAUSED there is no running purse to
            // spend from and the sweep would never process the fallout.
            if (auction.getStatus() != AuctionStatus.LIVE && auction.getStatus() != AuctionStatus.PAUSED) {
                throw ApiException.conflict("Players can only be assigned while the auction is live or paused");
            }
            AuctionLot lot = requireLot(auction, req.lotId());
            if (lot.getStatus() == AuctionLotStatus.SOLD) {
                throw ApiException.conflict("Re-auction the player before reassigning");
            }
            AuctionFranchise winner = requireParticipant(auction, req.franchiseId());
            if (req.price() < 0) {
                throw ApiException.badRequest("Price can't be negative");
            }
            // Sufficiency check, reserving the winner's own outstanding top bid on the block — otherwise
            // an assign could drive the purse negative when their live bid also finalizes.
            AuctionLot block = onBlock(auction);
            long reserved = block != null && block.getCurrentBidder() != null
                    && block.getCurrentBidder().getId().equals(winner.getId()) ? block.getCurrentBid() : 0;
            if (winner.getBalance() - reserved < req.price()) {
                throw ApiException.badRequest("Insufficient balance — the franchise can't cover this price"
                        + (reserved > 0 ? " on top of its outstanding bid" : ""));
            }
            boolean wasOnBlock = lot.getStatus() == AuctionLotStatus.ON_BLOCK;

            sell(lot, winner, req.price());
            if (wasOnBlock) {
                advanceQueue(auction);
            }
            auditService.record("auction.assign", "Auction", auction.getId().toString(),
                    (lot.getPlayer() != null ? lot.getPlayer().getGamerTag() : "A player")
                            + " assigned to " + participantName(winner) + " for " + req.price());
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
            // A re-queued lot is only processable while the sweep runs — LIVE/PAUSED only.
            if (auction.getStatus() != AuctionStatus.LIVE && auction.getStatus() != AuctionStatus.PAUSED) {
                throw ApiException.conflict("Lots can only be re-auctioned while the auction is live or paused");
            }
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
            auditService.record("auction.reauction", "Auction", auction.getId().toString(),
                    (lot.getPlayer() != null ? lot.getPlayer().getGamerTag() : "A lot")
                            + " returned to the queue");
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
            // Pre-LIVE budgets are managed via updateConfig's defaultBudget; top-ups are a live tool.
            if (auction.getStatus() != AuctionStatus.LIVE && auction.getStatus() != AuctionStatus.PAUSED) {
                throw ApiException.conflict("Funds can only be added while the auction is live or paused");
            }
            if (req.amount() <= 0) {
                throw ApiException.badRequest("Top-up amount must be positive");
            }
            AuctionFranchise af = requireParticipant(auction, req.franchiseId());
            af.setBudget(af.getBudget() + req.amount());
            af.setBalance(af.getBalance() + req.amount());
            auctionFranchiseRepository.save(af);
            auditService.record("auction.addfunds", "Auction", auction.getId().toString(),
                    "+" + req.amount() + " to " + participantName(af));
            return publishAndView(auction);
        } finally {
            lock.unlock();
        }
    }

    /**
     * The auto-advance engine, driven by {@link AuctionSweepService}. For every LIVE auction it either
     * (a) finalizes an on-block lot whose deadline expired (which starts an intermission), or (b) once
     * the intermission elapses and no lot is on the block, nominates the next queued lot. When the
     * queue is empty it does nothing — the auction idles LIVE until the admin acts (it never
     * auto-completes). PAUSED auctions are skipped. Runs in its own transaction (called from another
     * bean, so the proxy applies and the private helpers execute inside it).
     */
    @Transactional
    public void finalizeExpiredLots() {
        for (Auction candidate : auctionRepository.findByStatus(AuctionStatus.LIVE)) {
            if (!needsSweep(candidate)) {
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
                if (fresh != null) {
                    // (a) finalize an expired on-block lot — this starts the intermission.
                    if (fresh.getBidDeadline() != null && Instant.now().isAfter(fresh.getBidDeadline())) {
                        finalizeOnBlock(auction, fresh);
                        publishSnapshot(auction);
                    }
                } else if (intermissionElapsed(auction)) {
                    // (b) intermission over and nothing on the block — nominate the next queued lot.
                    AuctionLot next = auctionLotRepository
                            .findFirstByAuctionIdAndStatusOrderByLotOrderAsc(
                                    auction.getId(), AuctionLotStatus.QUEUED)
                            .orElse(null);
                    if (next != null) {
                        nominateLot(auction, next);
                        publishSnapshot(auction);
                    }
                }
            } finally {
                lock.unlock();
            }
        }
    }

    /** Cheap pre-check (outside the lock): is there sweep work for this LIVE auction? */
    private boolean needsSweep(Auction auction) {
        AuctionLot onBlock = onBlock(auction);
        if (onBlock != null) {
            return onBlock.getBidDeadline() != null && Instant.now().isAfter(onBlock.getBidDeadline());
        }
        return intermissionElapsed(auction)
                && auctionLotRepository
                        .findFirstByAuctionIdAndStatusOrderByLotOrderAsc(
                                auction.getId(), AuctionLotStatus.QUEUED)
                        .isPresent();
    }

    /** True when the auction is not (or no longer) waiting out a between-lots intermission. */
    private static boolean intermissionElapsed(Auction auction) {
        return auction.getIntermissionUntil() == null
                || !Instant.now().isBefore(auction.getIntermissionUntil());
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

    /** Mark a lot SOLD to a participant, debit their balance, attach the player (no per-sale ping). */
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
        // Per-sale "you won" pings are gone — a single summary is sent when the auction completes.
    }

    /**
     * Begin the between-lots intermission instead of nominating instantly. The sweep nominates the
     * next queued lot once the intermission elapses; the auction NEVER auto-completes when the queue
     * empties — it idles LIVE until the admin re-auctions or completes it manually.
     */
    private void advanceQueue(Auction auction) {
        auction.setIntermissionUntil(Instant.now().plusSeconds(auction.getIntermissionSeconds()));
        auctionRepository.save(auction);
    }

    /** Put a lot on the block with a fresh countdown and cleared bid state; ends any intermission. */
    private void nominateLot(Auction auction, AuctionLot lot) {
        lot.setStatus(AuctionLotStatus.ON_BLOCK);
        lot.setCurrentBid(0);
        lot.setCurrentBidder(null);
        // A short review window opens first (franchises study the player), then the bid timer runs.
        int review = Math.max(0, auction.getAntiSnipeSeconds());
        Instant opens = Instant.now().plusSeconds(review);
        lot.setBidOpensAt(review > 0 ? opens : null);
        lot.setBidDeadline(opens.plusSeconds(auction.getBidTimerSeconds()));
        auctionLotRepository.save(lot);
        if (auction.getIntermissionUntil() != null) {
            auction.setIntermissionUntil(null);
            auctionRepository.save(auction);
        }
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

    /**
     * Whether a user may open the live auction WebSocket: an admin, or the owner/manager of a
     * participating franchise (the bidders). Spectators are refused the socket and stay on polling.
     * The WS handshake calls this (it can't reuse the SecurityContext-based {@link #callerCanScout}).
     */
    @Transactional(readOnly = true)
    public boolean canWatchLive(UUID auctionId, UUID userId, boolean isAdmin) {
        if (isAdmin) {
            return true;
        }
        if (userId == null) {
            return false;
        }
        return auctionFranchiseRepository.findByAuctionId(auctionId).stream()
                .anyMatch(af -> ownedOrManagedBy(af.getFranchise(), userId));
    }

    private static boolean matchesUser(Player player, UUID userId) {
        return player != null && player.getUser() != null && player.getUser().getId().equals(userId);
    }

    /**
     * Whether the caller may see private scouting detail (player contact + in-game handles): an admin,
     * or the owner/manager of a franchise participating in this auction. Everyone else authenticated is a
     * spectator and gets the read-only, contact-stripped board. Never throws.
     */
    private boolean callerCanScout(Auction auction) {
        if (SecurityUtils.isAdmin()) {
            return true;
        }
        UUID uid;
        try {
            uid = SecurityUtils.currentUserId();
        } catch (RuntimeException ex) {
            return false;
        }
        return auctionFranchiseRepository.findByAuctionId(auction.getId()).stream()
                .anyMatch(af -> ownedOrManagedBy(af.getFranchise(), uid));
    }

    /**
     * The players that seed the pool: explicit ids, else the distinct standing pool — AUCTION
     * registrations that are ACTIVE, not yet consumed by a prior auction, and whose player is not
     * already on a franchise roster.
     */
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
            if (reg.getStatus() != RegistrationStatus.ACTIVE || reg.isConsumed()) {
                continue;
            }
            Player player = reg.getPlayer();
            if (player != null && player.getFranchise() == null) {
                distinct.putIfAbsent(player.getId(), player);
            }
        }
        return new ArrayList<>(distinct.values());
    }

    /**
     * Reset the standing auction pool after an auction completes: mark every ACTIVE, unconsumed
     * AUCTION registration as consumed so the next auction starts empty until new sign-ups arrive.
     */
    private void consumeAuctionPool() {
        List<Registration> pool = registrationRepository
                .findByTypeAndStatus(RegistrationType.AUCTION, RegistrationStatus.ACTIVE);
        List<Registration> toConsume = new ArrayList<>();
        for (Registration reg : pool) {
            if (!reg.isConsumed()) {
                reg.setConsumed(true);
                toConsume.add(reg);
            }
        }
        if (!toConsume.isEmpty()) {
            registrationRepository.saveAll(toConsume);
        }
    }

    /**
     * Keep OPEN (unlocked) DRAFT auction pools in sync with the standing registration pool: any ACTIVE,
     * unconsumed, un-rostered AUCTION registrant that isn't already a lot is appended as a QUEUED lot.
     * Players who sign up through ANY auction call keep getting added right up until the admin locks the
     * pool — after which the set is frozen. Called by the sweep.
     */
    @Transactional
    public void syncOpenPools() {
        for (Auction auction : auctionRepository.findByStatus(AuctionStatus.DRAFT)) {
            if (auction.getPoolLockedAt() != null) {
                continue; // pool frozen — no longer growing
            }
            ReentrantLock lock = lockFor(auction.getId());
            if (!lock.tryLock()) {
                continue;
            }
            try {
                syncPoolInto(auction);
            } finally {
                lock.unlock();
            }
        }
    }

    /**
     * Append any ACTIVE, unconsumed, un-rostered AUCTION registrant that isn't already a lot as a QUEUED
     * lot. The caller must hold the auction's lock.
     */
    private void syncPoolInto(Auction auction) {
        Set<UUID> present = new HashSet<>();
        int nextOrder = 0;
        for (AuctionLot l : auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(auction.getId())) {
            if (l.getPlayer() != null) {
                present.add(l.getPlayer().getId());
            }
            nextOrder = Math.max(nextOrder, l.getLotOrder() + 1);
        }
        Map<UUID, Player> toAdd = new LinkedHashMap<>();
        for (Registration reg : registrationRepository
                .findByTypeAndStatus(RegistrationType.AUCTION, RegistrationStatus.ACTIVE)) {
            if (reg.isConsumed()) {
                continue;
            }
            Player p = reg.getPlayer();
            if (p == null || p.getFranchise() != null || present.contains(p.getId())) {
                continue;
            }
            toAdd.putIfAbsent(p.getId(), p);
        }
        for (Player p : toAdd.values()) {
            AuctionLot lot = new AuctionLot();
            lot.setAuction(auction);
            lot.setPlayer(p);
            lot.setStatus(AuctionLotStatus.QUEUED);
            lot.setCurrentBid(0);
            lot.setLotOrder(nextOrder++);
            auctionLotRepository.save(lot);
        }
    }

    /**
     * Send ONE end-of-auction summary to each participating franchise's leadership: what they won and
     * what they spent, or that they signed no one.
     */
    private void notifyAuctionSummary(Auction auction) {
        String link = "/my/franchise/auction";
        for (AuctionFranchise af : auctionFranchiseRepository.findByAuctionId(auction.getId())) {
            List<String> won = new ArrayList<>();
            long spent = 0;
            for (AuctionLot lot : auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(auction.getId())) {
                if (lot.getStatus() == AuctionLotStatus.SOLD && lot.getSoldTo() != null
                        && lot.getSoldTo().getId().equals(af.getId())) {
                    Player player = lot.getPlayer();
                    won.add(player == null ? "a player" : player.getGamerTag());
                    spent += lot.getSoldPrice();
                }
            }
            String body = won.isEmpty()
                    ? "You didn't sign any players."
                    : "You won: " + String.join(", ", won) + " (spent " + spent + ").";
            notifyLeadership(af.getFranchise(), "Auction complete", body, link);
        }
    }

    /** Tell each pooled player how they fared: signed (by whom, for how much) or unsold. */
    private void notifyAuctionPlayers(Auction auction) {
        for (AuctionLot lot : auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(auction.getId())) {
            Player player = lot.getPlayer();
            if (player == null || player.getUser() == null) {
                continue;
            }
            if (lot.getStatus() == AuctionLotStatus.SOLD && lot.getSoldTo() != null) {
                String tag = lot.getSoldTo().getFranchise() != null
                        ? lot.getSoldTo().getFranchise().getTag() : "a franchise";
                notificationService.create(player.getUser(), NotificationType.AUCTION,
                        "You were signed!",
                        "You were signed by " + tag + " for " + lot.getSoldPrice() + ".",
                        "/my/franchise");
            } else if (lot.getStatus() == AuctionLotStatus.UNSOLD) {
                notificationService.create(player.getUser(), NotificationType.AUCTION,
                        "You went unsold",
                        "You weren't signed in this auction — you can re-enter the next auction pool.",
                        "/my/registrations");
            }
        }
    }

    /**
     * Notify a franchise's leadership — owner AND manager users — best-effort (missing owner/manager or
     * user is skipped; the same user is not notified twice when they hold both seats).
     */
    private void notifyLeadership(Franchise franchise, String title, String body, String link) {
        if (franchise == null) {
            return;
        }
        Set<UUID> notified = new HashSet<>();
        notifyPlayerUser(franchise.getOwnerPlayer(), notified, title, body, link);
        notifyPlayerUser(franchise.getManagerPlayer(), notified, title, body, link);
    }

    private void notifyPlayerUser(Player player, Set<UUID> notified, String title, String body, String link) {
        if (player == null || player.getUser() == null) {
            return;
        }
        User user = player.getUser();
        if (notified.add(user.getId())) {
            notificationService.create(user, NotificationType.AUCTION, title, body, link);
        }
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

    /**
     * Batch-build the static scouting map for every pooled player in one pass — three IN-queries (game
     * proficiencies, in-game handles, latest AUCTION registration) instead of a per-lot fan-out.
     */
    private Map<UUID, ScoutData> buildScoutMap(UUID auctionId) {
        List<AuctionLot> lots = auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(auctionId);
        List<UUID> playerIds = lots.stream()
                .map(AuctionLot::getPlayer)
                .filter(p -> p != null)
                .map(Player::getId)
                .distinct()
                .toList();
        if (playerIds.isEmpty()) {
            return Map.of();
        }

        // Real name is captured at registration onto the Player — read it straight off the lot's player.
        Map<UUID, String> realNameByPlayer = new HashMap<>();
        for (AuctionLot lot : lots) {
            Player p = lot.getPlayer();
            if (p != null) {
                realNameByPlayer.put(p.getId(), p.getRealName());
            }
        }

        Map<UUID, Map<UUID, String>> handlesByPlayer = new HashMap<>();
        for (PlayerGameUsername u : usernameRepository.findByPlayerIdIn(playerIds)) {
            if (u.getGame() == null || u.getPlayer() == null) {
                continue;
            }
            handlesByPlayer.computeIfAbsent(u.getPlayer().getId(), k -> new HashMap<>())
                    .put(u.getGame().getId(), u.getHandle());
        }
        Map<UUID, List<PlayerGameProficiency>> profByPlayer = proficiencyRepository.findByPlayerIdIn(playerIds)
                .stream().filter(pr -> pr.getPlayer() != null && pr.getGame() != null)
                .collect(Collectors.groupingBy(pr -> pr.getPlayer().getId()));
        Map<UUID, Registration> latestRegByPlayer = new HashMap<>();
        for (Registration reg : registrationRepository
                .findByPlayerIdInAndTypeOrderByCreatedAtDesc(playerIds, RegistrationType.AUCTION)) {
            if (reg.getPlayer() != null) {
                latestRegByPlayer.putIfAbsent(reg.getPlayer().getId(), reg);
            }
        }

        Map<UUID, ScoutData> map = new HashMap<>();
        for (UUID pid : playerIds) {
            Map<UUID, String> handles = handlesByPlayer.getOrDefault(pid, Map.of());
            List<AuctionLotView.Expertise> expertise = new ArrayList<>();
            for (PlayerGameProficiency prof : profByPlayer.getOrDefault(pid, List.of())) {
                expertise.add(new AuctionLotView.Expertise(
                        prof.getGame().getName(),
                        prof.getRating(),
                        handles.get(prof.getGame().getId()),
                        prof.getRankTier(),
                        prof.getKd(),
                        prof.getAccountLevel()));
            }
            List<String> games = new ArrayList<>();
            String contact = null;
            Registration latest = latestRegByPlayer.get(pid);
            if (latest != null) {
                if (latest.getGames() != null) {
                    games.addAll(latest.getGames());
                }
                contact = latest.getContact();
            }
            if (games.isEmpty()) {
                for (AuctionLotView.Expertise e : expertise) {
                    games.add(e.game());
                }
            }
            map.put(pid, new ScoutData(expertise, games, contact, realNameByPlayer.get(pid)));
        }
        return map;
    }

    /**
     * The scout map for an auction: served from the cache once the pool is frozen (LOBBY/LIVE/PAUSED/
     * COMPLETED), rebuilt live while a DRAFT pool is still growing, and rebuilt lazily if the cache was
     * lost (e.g. a restart mid-auction).
     */
    private Map<UUID, ScoutData> scoutMapFor(Auction auction) {
        // Cache only while the pool is frozen AND the auction is still running. A still-open DRAFT pool can
        // change, and a COMPLETED auction is no longer polled, so both are built fresh (never cached).
        if (auction.getPoolLockedAt() == null || auction.getStatus() == AuctionStatus.COMPLETED) {
            return buildScoutMap(auction.getId());
        }
        return scoutCache.computeIfAbsent(auction.getId(), this::buildScoutMap);
    }

    private AuctionView viewOf(Auction auction) {
        UUID aid = auction.getId();
        List<AuctionLot> lots = auctionLotRepository.findByAuctionIdOrderByLotOrderAsc(aid);
        List<AuctionFranchise> participants = auctionFranchiseRepository.findByAuctionId(aid);
        Map<UUID, ScoutData> scoutMap = scoutMapFor(auction);

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

        // Spectators (any authenticated non-participant) get a read-only board with private player
        // contact/handles stripped; participating owners/managers and admins keep full scouting detail.
        boolean includePrivate = callerCanScout(auction);

        List<AuctionFranchiseView> franchiseViews = new ArrayList<>();
        for (AuctionFranchise af : participants) {
            franchiseViews.add(franchiseView(af, acquired.getOrDefault(af.getId(), 0)));
        }
        List<AuctionLotView> lotViews = new ArrayList<>();
        for (AuctionLot lot : lots) {
            lotViews.add(lotView(lot, auction, includePrivate, scoutMap));
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
                auction.getPoolLockedAt() != null,
                auction.getBasePrice(),
                auction.getBidTimerSeconds(),
                auction.getAntiSnipeSeconds(),
                parseIncrements(auction.getRaiseIncrements()),
                auction.getDefaultBudget(),
                auction.getIntermissionSeconds(),
                auction.getScheduledAt(),
                Instant.now(),
                auction.getIntermissionUntil(),
                current == null ? null : lotView(current, auction, includePrivate, scoutMap),
                franchiseViews,
                lotViews,
                recentBids);
    }

    private AuctionLotView lotView(AuctionLot lot, Auction auction, boolean includePrivate,
                                   Map<UUID, ScoutData> scoutMap) {
        long minNext = lot.getCurrentBidder() == null
                ? auction.getBasePrice()
                : lot.getCurrentBid() + smallestIncrement(auction);
        Franchise bidder = lot.getCurrentBidder() == null ? null : lot.getCurrentBidder().getFranchise();
        Franchise soldTo = lot.getSoldTo() == null ? null : lot.getSoldTo().getFranchise();
        Player player = lot.getPlayer();
        List<AuctionLotView.Expertise> expertise = new ArrayList<>();
        List<String> games = new ArrayList<>();
        String contact = null;
        String realName = null;
        // Static scouting data is served from the pre-built map (no per-lot queries). Handle, contact
        // and real name are private, so they're stripped for spectators (non-scouts).
        ScoutData scout = player == null ? null : scoutMap.get(player.getId());
        if (scout != null) {
            for (AuctionLotView.Expertise e : scout.expertise()) {
                expertise.add(includePrivate ? e : new AuctionLotView.Expertise(
                        e.game(), e.rating(), null, e.rankTier(), e.kd(), e.accountLevel()));
            }
            games.addAll(scout.games());
            if (includePrivate) {
                contact = scout.contact();
                realName = scout.realName();
            }
        }
        return new AuctionLotView(
                lot.getId().toString(),
                player == null ? null : player.getId().toString(),
                player == null ? null : player.getGamerTag(),
                realName,
                lot.getStatus().name(),
                lot.getCurrentBid(),
                minNext,
                bidder == null ? null : bidder.getId().toString(),
                bidder == null ? null : bidder.getTag(),
                soldTo == null ? null : soldTo.getId().toString(),
                soldTo == null ? null : soldTo.getTag(),
                lot.getSoldPrice(),
                lot.getBidOpensAt(),
                lot.getBidDeadline(),
                lot.getLotOrder(),
                games,
                expertise,
                contact);
    }

    private static AuctionFranchiseView franchiseView(AuctionFranchise af, int acquiredCount) {
        Franchise franchise = af.getFranchise();
        return new AuctionFranchiseView(
                franchise == null ? null : franchise.getId().toString(),
                franchise == null ? null : franchise.getName(),
                franchise == null ? null : franchise.getTag(),
                af.getBudget(),
                af.getBalance(),
                acquiredCount,
                af.isJoined());
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
        Franchise franchise = franchiseRepository.findById(parseId(id, "Franchise"))
                .orElseThrow(() -> ApiException.notFound("Franchise", id));
        // A discarded franchise can never be enrolled in an auction (both create and edit route here).
        if (!franchise.isActive()) {
            throw ApiException.badRequest(
                    "Franchise '" + franchise.getName() + "' is discarded and can't take part in an auction");
        }
        return franchise;
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
