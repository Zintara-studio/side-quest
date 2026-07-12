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
import jakarta.persistence.Index;
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
@Table(name = "registrations", indexes = {
        @Index(name = "idx_registrations_player", columnList = "player_id"),
        @Index(name = "idx_registrations_match", columnList = "match_id"),
        @Index(name = "idx_registrations_type_status", columnList = "type, status")
})
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

    /** Proposed squad/team name for SQUAD registrations (or franchise name for FRANCHISE bids). */
    @Column(name = "squad_name")
    private String squadName;

    /**
     * Requested franchise tag/abbreviation for a FRANCHISE proposal (e.g. "RXG"). Optional — when blank
     * the tag is derived from the name at promotion time.
     */
    @Column(name = "franchise_tag", length = 16)
    private String franchiseTag;

    /** The FFA match this registration is entering, when the call was tied to a match. Optional. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id")
    private Match match;

    /**
     * The game this registration is for. Derived from the linked {@link Match} when the call is tied to
     * a match; otherwise resolved from the request's game hint (or left null for season/general
     * registrations). Lets the frontend show the correct game without a manual picker.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id")
    private Game game;

    /** Game titles the applicant is registering for. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "registration_games", joinColumns = @JoinColumn(name = "registration_id"))
    @Column(name = "game")
    private List<String> games = new ArrayList<>();

    /** Free-form contact (whatsapp/discord) captured at apply time. */
    @Column(name = "contact")
    private String contact;

    /** Desired roster size for a SQUAD registration — caps how many teammates can be invited. Null → default. */
    @Column(name = "team_size")
    private Integer teamSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RegistrationStatus status = RegistrationStatus.PENDING;

    /**
     * Whether this AUCTION registration has been drawn into a completed auction. Consumed registrations
     * are excluded from the pool of a later auction, so each auction starts empty until new
     * auction-call sign-ups arrive.
     */
    @Column(name = "consumed", nullable = false)
    private boolean consumed = false;

    /**
     * Whether the player has removed this (terminal) registration from their own "My Team" history. A
     * soft flag rather than a hard delete so squad-invite rows referencing it stay intact. {@code default
     * false} so a Postgres ADD COLUMN backfills existing rows.
     */
    @Column(name = "hidden", nullable = false, columnDefinition = "boolean default false")
    private boolean hidden = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    /** Rejection reason or approval note. */
    @Column(columnDefinition = "text")
    private String reason;
}
