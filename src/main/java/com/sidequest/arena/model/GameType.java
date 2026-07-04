package com.sidequest.arena.model;

/**
 * Classifies a {@link Game} by genre so result-entry and default scoring can suit each title without
 * bespoke per-game schemas.
 *
 * <ul>
 *   <li>{@code BATTLE_ROYALE} — placement-driven (BGMI, Free Fire, COD): finishing position feeds a
 *       placement-points ladder, so results are entered per round.</li>
 *   <li>{@code TACTICAL} — head-to-head rounds (Valorant, CS2, Rainbow Six): scored on kills/score,
 *       no placement ladder.</li>
 *   <li>{@code SPORTS} — single-score fixtures (FIFA): scored on the final result, no placement ladder.</li>
 *   <li>{@code FIGHTING} — 1v1/bracket bouts (Brawlhalla): scored on the final result, no placement ladder.</li>
 *   <li>{@code PARTY} — free-for-all placement (Smashkarts): finishing position feeds a placement ladder.</li>
 * </ul>
 */
public enum GameType {
    BATTLE_ROYALE,
    TACTICAL,
    SPORTS,
    FIGHTING,
    PARTY;

    /**
     * Whether this genre is scored by finishing position (a placement-points ladder). {@code true} for
     * {@code BATTLE_ROYALE} and {@code PARTY}; {@code false} for {@code TACTICAL}, {@code SPORTS} and
     * {@code FIGHTING} (which are scored on the final result / kills alone).
     */
    public boolean usesPlacement() {
        return this == BATTLE_ROYALE || this == PARTY;
    }

    /**
     * The default placement-points ladder to seed onto a new fixture of this genre: a comma-separated,
     * highest-first list when {@link #usesPlacement()}, or the empty string (no placement ladder) for
     * non-placement genres. {@code pointsPerKill} stays 1 for all genres (score/kills weighted 1).
     */
    public String defaultPlacementPoints() {
        return usesPlacement() ? "15,12,10,8,6,4,2,1" : "";
    }
}
