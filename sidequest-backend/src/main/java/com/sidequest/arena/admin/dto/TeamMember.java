package com.sidequest.arena.admin.dto;

/**
 * A staff account (admin or franchise manager) shown in the admin team roster.
 *
 * @param id    user id
 * @param name  display name
 * @param email contact email
 * @param role  platform role
 */
public record TeamMember(
        String id,
        String name,
        String email,
        String role
) {
}
