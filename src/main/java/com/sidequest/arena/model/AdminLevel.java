package com.sidequest.arena.model;

/**
 * Administrative tier, kept <strong>orthogonal</strong> to {@link Role}. A user's {@code role} still
 * carries their player / franchise identity (and its ordinal elevate/demote ladder); {@code adminLevel}
 * layers admin power on top, so a player can be appointed an admin without losing their player identity.
 *
 * <ul>
 *   <li>{@code NONE} — not an admin (the default).</li>
 *   <li>{@code ADMIN} — an appointed admin: day-to-day operations.</li>
 *   <li>{@code SUPER_ADMIN} — the single "main admin": everything an admin can do, plus the sensitive,
 *       hard-to-undo actions (start/finish a season, change a game's standings weight, run the whole
 *       auction workflow) and appointing/revoking other admins.</li>
 * </ul>
 *
 * Authorities are derived so that {@code ADMIN} grants {@code ROLE_ADMIN} and {@code SUPER_ADMIN} grants
 * both {@code ROLE_SUPER_ADMIN} and {@code ROLE_ADMIN} — every existing {@code hasRole('ADMIN')} gate
 * keeps working for both tiers unchanged.
 */
public enum AdminLevel {
    NONE,
    ADMIN,
    SUPER_ADMIN
}
