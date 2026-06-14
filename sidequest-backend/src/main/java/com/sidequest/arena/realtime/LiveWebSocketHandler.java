package com.sidequest.arena.realtime;

import com.sidequest.arena.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Maps an incoming WebSocket connection to a {@link RealtimeService} topic based on its path:
 * <ul>
 *   <li>{@code /ws/live/standings} → standings ticks</li>
 *   <li>{@code /ws/live/matches/{id}} → live scores for one match</li>
 *   <li>{@code /ws/live/me?token=&lt;jwt&gt;} → personal pushes for the authenticated user</li>
 * </ul>
 */
@Component
public class LiveWebSocketHandler extends TextWebSocketHandler {

    private static final Pattern MATCH_PATH = Pattern.compile(".*/live/matches/([^/]+)$");
    private static final Pattern TOKEN_PARAM = Pattern.compile("(?:^|&)token=([^&]+)");

    private final RealtimeService realtime;
    private final JwtService jwtService;

    public LiveWebSocketHandler(RealtimeService realtime, JwtService jwtService) {
        this.realtime = realtime;
        this.jwtService = jwtService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        String path = uri.getPath();
        String topic;

        Matcher m = MATCH_PATH.matcher(path);
        if (path.endsWith("/live/standings")) {
            topic = RealtimeService.STANDINGS_TOPIC;
        } else if (m.matches()) {
            topic = RealtimeService.matchTopic(m.group(1));
        } else if (path.endsWith("/live/me")) {
            UUID userId = resolveUser(uri.getQuery());
            if (userId == null) {
                session.close(CloseStatus.POLICY_VIOLATION);
                return;
            }
            topic = RealtimeService.userTopic(userId);
        } else {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        realtime.subscribe(topic, session);
        session.sendMessage(new TextMessage(
                "{\"event\":\"subscribed\",\"topic\":\"" + topic + "\"}"));
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        realtime.unsubscribeAll(session);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) throws Exception {
        // Lightweight heartbeat support: reply to "ping" with "pong".
        if ("ping".equalsIgnoreCase(message.getPayload().trim())) {
            session.sendMessage(new TextMessage("{\"event\":\"pong\"}"));
        }
    }

    private UUID resolveUser(String query) {
        if (query == null) {
            return null;
        }
        Matcher tm = TOKEN_PARAM.matcher(query);
        if (!tm.find()) {
            return null;
        }
        try {
            Claims claims = jwtService.parse(tm.group(1));
            return UUID.fromString(claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }

    // exposed for callers that want the supported topics documented
    public Map<String, String> describeRoutes() {
        return Map.of(
                "/ws/live/standings", "Live leaderboard ticks",
                "/ws/live/matches/{id}", "Live score updates for a match",
                "/ws/live/me?token=<jwt>", "Personal pushes (reg status, alerts)");
    }
}
