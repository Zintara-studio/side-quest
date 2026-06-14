package com.sidequest.arena.matches.dto;

/**
 * Minimal game reference embedded in match payloads (id + display name).
 *
 * @param id   the game's id
 * @param name the game's display name
 */
public record GameMini(String id, String name) {
}
