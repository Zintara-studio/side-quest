package com.sidequest.arena.registrations;

import com.sidequest.arena.announcements.AnnouncementService;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.repo.MatchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;

/**
 * Periodically locks a match's registrations once it reaches the configured lock window: the confirmed
 * rosters are frozen (FORMING/ACTIVE → LOCKED) and any still-pending squad invites are voided, so a
 * late accept can't change who's playing. Runs every minute; the per-match lock is idempotent.
 */
@Component
public class RegistrationLockService {

    private static final Logger log = LoggerFactory.getLogger(RegistrationLockService.class);

    /**
     * Statuses whose registrations can still need locking. COMPLETED and CANCELLED fixtures are
     * terminal — results-publication and cancellation both close their calls — so the sweep skips the
     * ever-growing history instead of re-querying every match ever played, every minute.
     */
    private static final EnumSet<MatchStatus> SWEEPABLE =
            EnumSet.of(MatchStatus.SCHEDULED, MatchStatus.LIVE, MatchStatus.AWAITING_RESULT);

    private final MatchRepository matchRepository;
    private final RegistrationService registrationService;
    private final AnnouncementService announcementService;

    public RegistrationLockService(MatchRepository matchRepository,
                                   RegistrationService registrationService,
                                   AnnouncementService announcementService) {
        this.matchRepository = matchRepository;
        this.registrationService = registrationService;
        this.announcementService = announcementService;
    }

    @Scheduled(fixedDelay = 60_000)
    public void sweep() {
        try {
            int lockHours = registrationService.lockHours();
            Instant now = Instant.now();
            // Bounded candidate set: only non-terminal fixtures whose lock window has opened
            // (scheduledAt − lockHours ≤ now  ⇔  scheduledAt ≤ now + lockHours).
            Instant cutoff = now.plus(Duration.ofHours(lockHours));
            for (Match match : matchRepository.findByStatusInAndScheduledAtBefore(SWEEPABLE, cutoff)) {
                if (match.getScheduledAt() == null) {
                    continue;
                }
                int locked = registrationService.lockMatchRegistrations(match.getId());
                if (locked > 0) {
                    log.info("Locked {} registration(s) for match {}", locked, match.getId());
                }
                // Once the window passes, close the linked registration call so its Register button
                // disappears (idempotent — a no-op once already closed).
                announcementService.closeForMatch(match.getId());
            }
        } catch (Exception ex) {
            log.warn("Registration lock sweep failed", ex);
        }
    }
}
