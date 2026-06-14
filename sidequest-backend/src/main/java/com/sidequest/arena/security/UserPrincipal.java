package com.sidequest.arena.security;

import com.sidequest.arena.model.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Authenticated principal placed on the SecurityContext. Carries the user id and role so
 * controllers/services can authorize and attribute actions without another DB hit.
 */
public class UserPrincipal implements UserDetails {

    private final UUID userId;
    private final String email;
    private final Role role;

    public UserPrincipal(UUID userId, String email, Role role) {
        this.userId = userId;
        this.email = email;
        this.role = role;
    }

    public UUID getUserId() {
        return userId;
    }

    public Role getRole() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
