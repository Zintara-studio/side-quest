package com.sidequest.arena.model;

/**
 * How a match is contested.
 *
 * <ul>
 *   <li>{@code FRANCHISE} — franchises compete; participating players are pulled from the
 *       participating franchises' rosters.</li>
 *   <li>{@code FFA} — free-for-all; participating players are pulled from the approved registrations
 *       tied to the match.</li>
 * </ul>
 */
public enum MatchType {
    FRANCHISE,
    FFA
}
