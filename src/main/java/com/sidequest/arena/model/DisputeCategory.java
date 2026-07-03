package com.sidequest.arena.model;

/**
 * What a {@link Dispute} is about:
 * <ul>
 *   <li>{@code RESULT} — a challenge against a published match result (has a match);</li>
 *   <li>{@code APPEAL} — an appeal against an account action (e.g. flag/suspension), no match;</li>
 *   <li>{@code GENERAL} — any other issue raised for admin attention, no match required.</li>
 * </ul>
 */
public enum DisputeCategory {
    RESULT,
    APPEAL,
    GENERAL
}
