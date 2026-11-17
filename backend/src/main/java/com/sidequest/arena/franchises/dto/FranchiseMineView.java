package com.sidequest.arena.franchises.dto;

/**
 * The current user's franchise plus the role they hold on it, for the "my franchise" screen. Returned
 * only when the caller is a player who belongs to a franchise; {@code null} otherwise.
 *
 * @param franchise the full franchise detail
 * @param myRole    the caller's role on it: {@code OWNER}, {@code MANAGER}, {@code IGL}, or {@code PLAYER}
 */
public record FranchiseMineView(
        FranchiseDetail franchise,
        String myRole
) {
}
