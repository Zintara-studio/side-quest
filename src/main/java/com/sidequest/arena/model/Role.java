package com.sidequest.arena.model;

/**
 * Platform roles enforced on mutating routes. A franchise owner outranks a manager and inherits
 * manager permissions; an admin outranks everyone. Spring Security authorities are derived as
 * {@code ROLE_<name>}.
 */
public enum Role {
    PLAYER,
    FRANCHISE_MANAGER,
    FRANCHISE_OWNER,
    ADMIN
}
