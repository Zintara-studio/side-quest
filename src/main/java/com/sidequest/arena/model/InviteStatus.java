package com.sidequest.arena.model;

/** Lifecycle of a squad {@link TeamInvite}: awaiting a response, accepted, or declined. */
public enum InviteStatus {
    PENDING,
    ACCEPTED,
    REJECTED
}
