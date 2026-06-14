package com.sidequest.arena.games.dto;

/**
 * Admin patch for a game. All fields are optional; only non-null fields are applied. {@code enabled}
 * toggles visibility, {@code regOpen} toggles the registration window, {@code popularity} drives the
 * popularity bars, and {@code format}/{@code iconUrl} update presentation.
 */
public record UpdateGameRequest(
        Boolean enabled,
        Boolean regOpen,
        Integer popularity,
        String format,
        String iconUrl
) {
}
