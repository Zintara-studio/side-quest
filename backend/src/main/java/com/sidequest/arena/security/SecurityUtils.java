package com.sidequest.arena.security;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import com.sidequest.arena.model.AdminLevel;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

/**
 * Convenience accessors for the currently authenticated principal. Services use these to attribute
 * actions and enforce ownership ("edit own profile") rules.
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Optional<UserPrincipal> currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) {
            return Optional.of(p);
        }
        return Optional.empty();
    }

    public static UserPrincipal requirePrincipal() {
        return currentPrincipal()
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Authentication required"));
    }

    public static UUID currentUserId() {
        return requirePrincipal().getUserId();
    }

    /** True for any admin tier (appointed admin or the main admin). */
    public static boolean isAdmin() {
        return currentPrincipal().map(p -> p.getAdminLevel() != AdminLevel.NONE).orElse(false);
    }

    /** True only for the main admin (super-admin), who alone may perform the sensitive/undo-less actions. */
    public static boolean isSuperAdmin() {
        return currentPrincipal().map(p -> p.getAdminLevel() == AdminLevel.SUPER_ADMIN).orElse(false);
    }
}
