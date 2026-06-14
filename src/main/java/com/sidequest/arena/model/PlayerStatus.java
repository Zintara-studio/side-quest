package com.sidequest.arena.model;

/** Player account standing, controlled by admins via {@code PATCH /players/:id/status}. */
public enum PlayerStatus {
    PENDING,
    VERIFIED,
    FLAGGED,
    SUSPENDED
}
