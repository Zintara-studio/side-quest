package com.sidequest.arena.security;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Stateless JWT security. Public catalog reads are open; auth endpoints are open; everything else
 * requires a valid access token. Admin / owner gating is applied per-route via {@code @PreAuthorize}
 * (method security) in the controllers.
 */
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RestAuthEntryPoint authEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    @Value("${sidequest.cors.allowed-origins:*}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          RestAuthEntryPoint authEntryPoint,
                          RestAccessDeniedHandler accessDeniedHandler) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.authEntryPoint = authEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                // sameOrigin keeps clickjacking protection in prod while still allowing the dev H2 console frame
                .headers(h -> h.frameOptions(f -> f.sameOrigin()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // --- infra / docs ---
                        .requestMatchers("/docs/**", "/swagger-ui/**", "/swagger-ui.html",
                                "/api-docs/**", "/v3/api-docs/**", "/h2-console/**",
                                "/actuator/health", "/actuator/info").permitAll()
                        // --- auth (public) ---
                        .requestMatchers("/auth/register", "/auth/login", "/auth/refresh").permitAll()
                        // --- authenticated franchise reads (must precede the broad permitAll GET below,
                        //     otherwise these would fall through to public and break current-user lookup) ---
                        .requestMatchers(HttpMethod.GET, "/franchises/mine",
                                "/franchises/invites/mine").authenticated()
                        .requestMatchers(HttpMethod.GET, "/franchises/*/invites").authenticated()
                        // --- public catalog reads (player app browses these unauthenticated) ---
                        .requestMatchers(HttpMethod.GET,
                                "/players/**", "/franchises/**", "/games/**", "/matches/**",
                                "/standings/**", "/leaderboard/**", "/announcements/**",
                                "/seasons/**", "/auctions/**").permitAll()
                        // --- realtime handshake is authenticated at the WS layer ---
                        .requestMatchers("/ws/**", "/live/**").permitAll()
                        // --- everything else requires a valid token ---
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(authEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
        boolean wildcard = origins.isEmpty() || origins.contains("*");
        if (wildcard) {
            config.addAllowedOriginPattern("*");
        } else {
            config.setAllowedOrigins(origins);
        }
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        // Never combine a wildcard origin with credentials (unsafe, and browsers reject it). Auth rides
        // in the Authorization header, so credentialed CORS is only enabled for an explicit allow-list.
        config.setAllowCredentials(!wildcard);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
