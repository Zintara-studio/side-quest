package com.sidequest.arena.security;

import com.sidequest.arena.model.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Reads the {@code Authorization: Bearer <jwt>} header, validates the access token, and populates
 * the SecurityContext with a {@link UserPrincipal}. Invalid/expired tokens are ignored here (the
 * request proceeds unauthenticated and is rejected by the authorization layer if the route is
 * protected) — this keeps public routes working with stale headers.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = header.substring(7).trim();
            try {
                Claims claims = jwtService.parse(token);
                if ("access".equals(claims.get("typ", String.class))) {
                    UUID userId = UUID.fromString(claims.getSubject());
                    String email = claims.get("email", String.class);
                    Role role = Role.valueOf(claims.get("role", String.class));
                    UserPrincipal principal = new UserPrincipal(userId, email, role);
                    var auth = new UsernamePasswordAuthenticationToken(
                            principal, null, principal.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (JwtException | IllegalArgumentException ignored) {
                // Invalid token → leave context unauthenticated.
            }
        }
        filterChain.doFilter(request, response);
    }
}
