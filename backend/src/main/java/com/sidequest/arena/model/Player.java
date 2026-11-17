package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A competitor profile, 1:1 with a {@link User}. May belong to a {@link Franchise} (assigned via
 * auction). {@code points} accumulates from match results and drives the player leaderboard.
 */
@Entity
@Table(name = "players", indexes = {
        @Index(name = "idx_players_franchise", columnList = "franchise_id"),
        @Index(name = "idx_players_points", columnList = "points"),
        // gamerTag is the public handle/username and must be unique site-wide. The app layer also
        // rejects case-insensitive duplicates at signup; this index is the DB backstop against exact dups.
        @Index(name = "idx_players_gamer_tag", columnList = "gamer_tag", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
public class Player extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "franchise_id")
    private Franchise franchise;

    /** Public handle shown across the platform (defaults to the user's name). */
    @Column(name = "gamer_tag", nullable = false)
    private String gamerTag;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column
    private String region;

    @Column(columnDefinition = "text")
    private String bio;

    // ---- contact / identity (per-field privacy; private by default) ----

    /** Real name for the profile / auction paperwork. Private unless {@link #realNamePublic}. */
    @Column(name = "real_name")
    private String realName;

    /** Contact phone (distinct from the account login phone on {@link User}). Private unless {@link #phonePublic}. */
    @Column(name = "phone")
    private String phone;

    /** Public-facing contact email (distinct from the login email on {@link User}). Private unless {@link #contactEmailPublic}. */
    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "real_name_public", nullable = false)
    private boolean realNamePublic = false;

    @Column(name = "phone_public", nullable = false)
    private boolean phonePublic = false;

    @Column(name = "contact_email_public", nullable = false)
    private boolean contactEmailPublic = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PlayerStatus status = PlayerStatus.PENDING;

    @Column(nullable = false)
    private int points = 0;

    /**
     * True only for a fresh Google/OAuth signup that hasn't completed the "choose your username +
     * profile" onboarding step. Defaults false so every existing player — and every email signup,
     * which types its username up front — is already onboarded. Cleared when onboarding is submitted.
     * The explicit {@code default false} lets the additive Postgres column backfill existing rows.
     */
    @Column(name = "onboarding_required", nullable = false, columnDefinition = "boolean not null default false")
    private boolean onboardingRequired = false;
}
