package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A squad invitation: the captain of a SQUAD {@link Registration} invites another player to join the
 * roster. The invited player accepts or declines; the captain may re-invite someone who declined or
 * invite different players. The accepted members (plus the captain) make up the team the admin verifies.
 */
@Entity
@Table(name = "team_invites", indexes = {
        @Index(name = "idx_team_invites_registration", columnList = "registration_id"),
        @Index(name = "idx_team_invites_invited", columnList = "invited_player_id")
})
@Getter
@Setter
@NoArgsConstructor
public class TeamInvite extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "registration_id", nullable = false)
    private Registration registration;

    /** The player being invited onto the squad. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_player_id", nullable = false)
    private Player invitedPlayer;

    /** The captain who sent the invite (the registration's applicant). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_by_player_id", nullable = false)
    private Player invitedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InviteStatus status = InviteStatus.PENDING;

    @Column(columnDefinition = "text")
    private String message;
}
