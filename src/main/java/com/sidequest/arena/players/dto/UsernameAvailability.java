package com.sidequest.arena.players.dto;

/**
 * Result of the live username-availability check ({@code GET /players/username-available}).
 *
 * @param available whether the username is free to claim (valid shape AND not taken)
 * @param reason    a human-readable reason when unavailable (bad shape or already taken); {@code null} when available
 */
public record UsernameAvailability(boolean available, String reason) {
}
