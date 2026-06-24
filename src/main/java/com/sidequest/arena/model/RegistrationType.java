package com.sidequest.arena.model;

/**
 * What a registration is for:
 * <ul>
 *   <li>{@code PLAYER} — an individual player (free-for-all / solo);</li>
 *   <li>{@code SQUAD} — a full squad for an FFA team match;</li>
 *   <li>{@code FRANCHISE} — a bid to form a franchise (pre-season), which an admin may approve into a
 *       franchise.</li>
 * </ul>
 */
public enum RegistrationType {
    PLAYER,
    SQUAD,
    FRANCHISE
}
