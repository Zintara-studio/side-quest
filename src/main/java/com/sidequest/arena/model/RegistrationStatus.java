package com.sidequest.arena.model;

/**
 * State of a registration. Match registrations (PLAYER/SQUAD) no longer pass through an admin
 * approval queue — they are live from creation and lock automatically before the match. The
 * PENDING/APPROVED/REJECTED states now only apply to admin-curated FRANCHISE-creation proposals
 * (and REJECTED doubles as "discarded by an admin" for any registration).
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
    /** Declined / discarded by an admin (also used to void a registration). */
    REJECTED
}
