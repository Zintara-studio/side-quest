package com.sidequest.arena.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers the realtime hub endpoints. These sit under {@code /ws/live/**} (context path {@code /v1}),
 * mirroring the architecture doc's {@code WS /live/...} channels.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final LiveWebSocketHandler handler;

    public WebSocketConfig(LiveWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler,
                        "/ws/live/standings",
                        "/ws/live/matches/*",
                        "/ws/live/auctions/*",
                        "/ws/live/me")
                .setAllowedOriginPatterns("*");
    }
}
