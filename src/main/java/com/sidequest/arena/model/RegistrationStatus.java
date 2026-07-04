package com.sidequest.arena.model;

/** Approval-queue state for a registration application. */
public enum RegistrationStatus {
    /** Squad still being assembled by its captain (inviting teammates); not yet in the admin queue. */
    FORMING,
    /** Submitted and awaiting admin review. */
    PENDING,
    APPROVED,
    REJECTED
}
