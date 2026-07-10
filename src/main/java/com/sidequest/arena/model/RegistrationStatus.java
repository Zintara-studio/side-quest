package com.sidequest.arena.model;

/**
 * State of a registration. Match registrations (PLAYER/SQUAD) no longer pass through an admin
 * approval queue — they are live from creation and lock automatically before the match. The
 * PENDING/APPROVED states apply only to admin-curated FRANCHISE-creation proposals. Voids split by
 * intent: REJECTED is an admin's punitive discard; WITHDRAWN is a neutral, non-punitive void — the
 * player pulling out, a call/season closing, or auto-regrouping when a player joins another team.
 */
public enum RegistrationStatus {
    /** Squad being assembled by its captain — registered and open for invites until the lock. */
    FORMING,
    /** Registered and counting toward the match: a solo entry, or a player in the auction pool. */
    ACTIVE,
    /** Roster frozen at the registration-lock deadline; pending invites are voided. */
    LOCKED,
    /** A FRANCHISE-creation proposal awaiting admin action. */
    PENDING,
    /** A FRANCHISE proposal that was converted into a real franchise. */
    APPROVED,
    /** Discarded by an admin — a punitive rejection. */
    REJECTED,
    /** Neutrally voided: withdrawn by the player, or auto-voided by call/season closure or regrouping. */
    WITHDRAWN
}
