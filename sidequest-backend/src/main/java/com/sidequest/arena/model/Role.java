package com.sidequest.arena.model;

/**
 * Platform roles enforced on mutating routes (per architecture doc: player · franchise mgr · admin).
 * Spring Security authorities are derived as {@code ROLE_<name>}.
 */
public enum Role {
    PLAYER,
    FRANCHISE_MANAGER,
    ADMIN
}
