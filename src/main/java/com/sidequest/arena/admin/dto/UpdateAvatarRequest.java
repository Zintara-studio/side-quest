package com.sidequest.arena.admin.dto;

/**
 * Sets the calling admin's account-level avatar. {@code avatarUrl} must be a server-issued
 * {@code /media/{id}} reference (upload via {@code POST /media} first), or blank to clear it.
 *
 * @param avatarUrl the new avatar reference, or blank/empty to remove the current one
 */
public record UpdateAvatarRequest(String avatarUrl) {
}
