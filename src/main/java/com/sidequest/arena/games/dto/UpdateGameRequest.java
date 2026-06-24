package com.sidequest.arena.games.dto;

/**
 * Admin patch for a game. All fields are optional; only non-null fields are applied. {@code enabled}
 * toggles visibility, {@code popularity} drives the popularity bars, and {@code format}/{@code iconUrl}
 * update presentation. (Registration windows are opened per announcement, not per game.)
 */
public record UpdateGameRequest(
        Boolean enabled,
        Integer popularity,
        String format,
        String iconUrl
) {
}
