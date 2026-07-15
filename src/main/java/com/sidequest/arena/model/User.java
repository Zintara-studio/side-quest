package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An account on the platform. {@code role} separates player / franchise manager / admin and
 * gates the API surface. Login is by email or phone + password.
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_email", columnList = "email", unique = true),
        @Index(name = "idx_users_phone", columnList = "phone")
})
@Getter
@Setter
@NoArgsConstructor
public class User extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column
    private String phone;

    /**
     * Account-level avatar (a server-issued {@code /media/{id}} reference). Players normally carry their
     * avatar on their {@link Player}; this is the fallback for accounts that have no player — chiefly the
     * league admin — so they can still set a profile picture. Nullable; ADD COLUMN-safe.
     */
    @Column(name = "avatar_url")
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Role role = Role.PLAYER;

    /**
     * Administrative tier, orthogonal to {@link #role} (see {@link AdminLevel}). {@code NONE} for a
     * normal player; an appointed admin keeps their {@code role} (player/franchise identity) and gains
     * {@code ADMIN}; the single main admin holds {@code SUPER_ADMIN}. {@code default 'NONE'} in the
     * column definition so a Postgres {@code ddl-auto: update} ADD COLUMN backfills existing rows and
     * satisfies NOT NULL.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "admin_level", nullable = false, length = 32, columnDefinition = "varchar(32) default 'NONE'")
    private AdminLevel adminLevel = AdminLevel.NONE;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /**
     * Whether the person has proven control of {@link #email} (via the email OTP or Google Sign-In).
     * Gates login — an unverified account cannot sign in. Distinct from {@code Player.status == VERIFIED}
     * (the auction/franchise-eligibility flag); verifying the email also promotes the Player to VERIFIED.
     */
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;
}
