package com.sidequest.arena.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * An application to join the league — either a single player (free-for-all) or a squad (franchise
 * season). Moves through the approval queue (PENDING → APPROVED/REJECTED).
 */
@Entity
@Table(name = "registrations")
@Getter
@Setter
@NoArgsConstructor
public class Registration extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RegistrationType type;

    /** Applicant player (for PLAYER type, and the squad captain for SQUAD type). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player_id")
    private Player player;

    /** Proposed squad/team name for SQUAD registrations. */
    @Column(name = "squad_name")
    private String squadName;

    /** Game titles the applicant is registering for. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "registration_games", joinColumns = @JoinColumn(name = "registration_id"))
    @Column(name = "game")
    private List<String> games = new ArrayList<>();

    /** Free-form contact (whatsapp/discord) captured at apply time. */
    @Column(name = "contact")
    private String contact;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RegistrationStatus status = RegistrationStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    /** Rejection reason or approval note. */
    @Column(columnDefinition = "text")
    private String reason;
}
