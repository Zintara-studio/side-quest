package com.sidequest.arena.model;

/** Lifecycle of a fixture. {@code AWAITING_RESULT} is the gate for the scoring engine. */
public enum MatchStatus {
    SCHEDULED,
    LIVE,
    AWAITING_RESULT,
    COMPLETED,
    CANCELLED
}
