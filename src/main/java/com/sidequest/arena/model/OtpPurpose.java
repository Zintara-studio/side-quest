package com.sidequest.arena.model;

/** What a one-time code authorizes. */
public enum OtpPurpose {
    /** Confirm a new account's email address (promotes the user to verified + the player to VERIFIED). */
    VERIFY_EMAIL,
    /** Authorize a password reset. */
    RESET_PASSWORD
}
