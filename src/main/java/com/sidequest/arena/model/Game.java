package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A supported title (Valorant, BGMI, CS2, ...). {@code enabled} toggles visibility; {@code popularity}
 * backs the popularity bars. Registration windows are no longer a per-game switch — they are opened
 * per announcement (see {@link Announcement#isRegistrationOpen()}).
 */
@Entity
@Table(name = "games")
@Getter
@Setter
@NoArgsConstructor
public class Game extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String name;

    /** e.g. "5v5", "Battle Royale · Squads", "1v1". */
    @Column(nullable = false)
    private String format;

    @Column(name = "icon_url")
    private String iconUrl;

    @Column(nullable = false)
    private boolean enabled = true;

    /** 0–100 popularity used for the games-grid bars. */
    @Column(nullable = false)
    private int popularity = 0;
}
