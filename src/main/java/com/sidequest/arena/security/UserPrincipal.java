package com.sidequest.arena.security;

import com.sidequest.arena.model.AdminLevel;
import com.sidequest.arena.model.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Authenticated principal placed on the SecurityContext. Carries the user id, role and admin tier so
 * controllers/services can authorize and attribute actions without another DB hit.
 */
public class UserPrincipal implements UserDetails {

    private final UUID userId;
    private final String email;
    private final Role role;
    private final AdminLevel adminLevel;

    public UserPrincipal(UUID userId, String email, Role role, AdminLevel adminLevel) {
        this.userId = userId;
        this.email = email;
        this.role = role;
        this.adminLevel = adminLevel == null ? AdminLevel.NONE : adminLevel;
    }

    public UUID getUserId() {
        return userId;
    }

    public Role getRole() {
        return role;
    }

    public AdminLevel getAdminLevel() {
        return adminLevel;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // ROLE_<role> keeps player/franchise gates working; admin power is layered on from adminLevel so
        // an appointed admin (role still PLAYER/FRANCHISE_*) still passes every hasRole('ADMIN') gate, and
        // the main admin additionally passes hasRole('SUPER_ADMIN').
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name()));
        if (adminLevel == AdminLevel.SUPER_ADMIN) {
            authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        } else if (adminLevel == AdminLevel.ADMIN) {
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        }
        return authorities;
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
