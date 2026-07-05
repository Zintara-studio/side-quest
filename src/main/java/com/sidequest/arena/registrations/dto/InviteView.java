package com.sidequest.arena.registrations.dto;

import java.time.Instant;
import java.util.List;

/**
 * An invitation as seen by the invited player on their "my invitations" screen.
 *
 * @param id              invite id
 * @param registrationId  the squad registration this invite belongs to
 * @param squadName       the squad's proposed name
 * @param captainGamerTag the captain who sent the invite
 * @param games           game titles the squad registered for
 * @param status          {@link com.sidequest.arena.model.InviteStatus} name
 * @param message         optional note from the captain, nullable
 * @param createdAt       when the invite was sent
 * @param members         the squad's current roster (captain + invitees with their status), so the
 *                        invited player can see who's already confirmed before accepting
 */
public record InviteView(
        String id,
        String registrationId,
        String squadName,
        String captainGamerTag,
        List<String> games,
        String status,
        String message,
        Instant createdAt,
        List<MemberView> members
) {

    /** A squad member row shown to an invitee: the captain, or another invited player. */
    public record MemberView(
            String gamerTag,
            String status,
            boolean isCaptain
    ) {
    }
}
