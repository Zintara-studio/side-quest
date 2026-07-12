package com.sidequest.arena.admin.dto;

/**
 * A staff account (admin or franchise manager) shown in the admin team roster.
 *
 * @param id         user id
 * @param name       display name
 * @param email      contact email
 * @param role       platform role (player/franchise identity)
 * @param adminLevel admin tier: {@code NONE} / {@code ADMIN} / {@code SUPER_ADMIN}
 * @param playerId   the linked player id, or {@code null} (only players can be appointed admins)
 */
public record TeamMember(
        String id,
        String name,
        String email,
        String role,
        String adminLevel,
        String playerId
) {
}
