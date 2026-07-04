package com.sidequest.arena.matches.dto;

/**
 * Minimal game reference embedded in match payloads (id + display name + genre). {@code gameType} lets
 * the result UI adapt per genre (placement-driven vs single-result scoring) without a separate lookup.
 *
 * @param id       the game's id
 * @param name     the game's display name
 * @param gameType the game's {@link com.sidequest.arena.model.GameType} name (e.g. "BATTLE_ROYALE")
 */
public record GameMini(String id, String name, String gameType) {
}
