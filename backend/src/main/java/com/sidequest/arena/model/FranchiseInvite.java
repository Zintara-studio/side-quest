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
 * A franchise ownership/management invitation: the franchise owner (or an admin) invites a player to
 * become the new {@code OWNER} (ownership transfer) or the {@code MANAGER}. The invited player accepts
 * or rejects; a rejected invite may be re-opened. Mirrors the squad {@link TeamInvite} handshake.
 */
@Entity
@Table(name = "franchise_invites", indexes = {
        @Index(name = "idx_franchise_invites_franchise", columnList = "franchise_id"),
        @Index(name = "idx_franchise_invites_invited", columnList = "invited_player_id")
})
@Getter
@Setter
@NoArgsConstructor
public class FranchiseInvite extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "franchise_id", nullable = false)
    private Franchise franchise;

    /** The player being invited into the owner/manager slot. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_player_id", nullable = false)
    private Player invitedPlayer;

    /** The owner (or admin's player) who sent the invite. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invited_by_player_id", nullable = false)
    private Player invitedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FranchiseRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InviteStatus status = InviteStatus.PENDING;

    @Column(columnDefinition = "text")
    private String message;
}
