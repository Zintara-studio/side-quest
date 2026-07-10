package com.sidequest.arena.matches.dto;

import java.util.List;

/**
 * The participant-only match room for {@code GET /matches/{id}/room}. Carries the (private) lobby
 * {@code roomId} + {@code venue} and the message history. Only served to the match's participants,
 * that franchise's leadership, or an admin — never to spectators (so the lobby code doesn't leak).
 *
 * @param matchId  the match id
 * @param status   the match status (room is active only while LIVE)
 * @param live     whether the room is currently active (status == LIVE)
 * @param roomId   the lobby / room code for the current session (nullable)
 * @param venue    the match venue (mirrors the match arena, nullable)
 * @param messages the room's messages, oldest first
 */
public record MatchRoomView(
        String matchId,
        String status,
        boolean live,
        String roomId,
        String venue,
        List<MatchMessageView> messages
) {
}
