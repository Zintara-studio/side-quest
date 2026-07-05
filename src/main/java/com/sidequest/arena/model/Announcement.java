package com.sidequest.arena.model;

import jakarta.persistence.Column;
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

import java.time.Instant;

/**
 * A league-feed post (news, result, recap, roster move). Optionally tied to a {@link Match}
 * (Announcement N—1 Match).
 */
@Entity
@Table(name = "announcements")
@Getter
@Setter
@NoArgsConstructor
public class Announcement extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AnnouncementCategory category = AnnouncementCategory.GENERAL;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text", nullable = false)
    private String body;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id")
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(name = "published_at", nullable = false)
    private Instant publishedAt;

    /** When true this announcement is a registration call (sign-ups open from it). */
    @Column(name = "registration_open", nullable = false)
    private boolean registrationOpen = false;

    /** Optional game this registration call is for (null = season/general registration). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id")
    private Game game;

    /**
     * Registration mode for this call. Season registrations are always {@code PLAYER} (solo);
     * free-for-all match calls may be {@code PLAYER} or {@code SQUAD}, chosen by the organizer.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "registration_type", length = 16)
    private RegistrationType registrationType = RegistrationType.PLAYER;

    /** For a SQUAD registration call: the roster size squads should register for (invite cap). Nullable. */
    @Column(name = "team_size")
    private Integer teamSize;
}
