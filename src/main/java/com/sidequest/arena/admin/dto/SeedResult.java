package com.sidequest.arena.admin.dto;

/**
 * Result of a static-config seed (POST /admin/seed).
 *
 * @param gamesCreated how many catalogue games were newly inserted this call (0 if already seeded)
 * @param gamesTotal   the total number of games after seeding
 */
public record SeedResult(int gamesCreated, long gamesTotal) {
}
