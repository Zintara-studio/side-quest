package com.sidequest.arena.model;

/** Lifecycle of a squad {@link TeamInvite}: awaiting a response, accepted, declined, or voided. */
public enum InviteStatus {
    PENDING,
    ACCEPTED,
    REJECTED,
    /** Voided because the match's registration locked before the invitee responded. */
    EXPIRED
}
