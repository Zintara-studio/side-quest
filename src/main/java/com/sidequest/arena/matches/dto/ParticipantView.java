package com.sidequest.arena.matches.dto;

/**
 * A franchise on a match roster.
 *
 * @param franchiseId the franchise id
 * @param name        the franchise name
 * @param tag         the franchise short tag
 */
public record ParticipantView(String franchiseId, String name, String tag) {
}
