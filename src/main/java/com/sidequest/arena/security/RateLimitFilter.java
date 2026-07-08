package com.sidequest.arena.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Coarse per-IP rate limiter for the unauthenticated auth endpoints (login / register / refresh) to
 * blunt credential-stuffing and bcrypt-driven CPU exhaustion on a small public instance. Fixed
 * one-minute window; returns 429 once the cap is exceeded. Behind a proxy/ALB, the first
 * X-Forwarded-For hop is used as the client identity.
 */
@Component
@Profile("!dev") // active on real deploys only; the local dev/demo profile (and the test suite) skip it
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_PER_MINUTE = 10;

    private final Cache<String, AtomicInteger> hits = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1))
            .maximumSize(100_000)
            .build();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Servlet path excludes the /v1 context path, so these match "/auth/login" etc.
        String p = request.getServletPath();
        return !("POST".equalsIgnoreCase(request.getMethod())
                && (p.equals("/auth/login") || p.equals("/auth/register") || p.equals("/auth/refresh")));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = clientIp(request) + " " + request.getServletPath();
        int count = hits.get(key, k -> new AtomicInteger()).incrementAndGet();
        if (count > MAX_PER_MINUTE) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"code\":\"RATE_LIMITED\",\"message\":\"Too many attempts. Please wait a minute and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
