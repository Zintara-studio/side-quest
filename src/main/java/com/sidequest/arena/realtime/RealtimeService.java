package com.sidequest.arena.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-process pub/sub for the WebSocket hub. Topics:
 * <ul>
 *   <li>{@code standings} — live leaderboard ticks</li>
 *   <li>{@code match:&lt;id&gt;} — per-match live score updates</li>
 *   <li>{@code me:&lt;userId&gt;} — personal pushes (registration status, alerts)</li>
 * </ul>
 * In production this is backed by Redis pub/sub so it fans out across instances; the public API here
 * is the seam where that swap happens.
 */
@Service
public class RealtimeService {

    private static final Logger log = LoggerFactory.getLogger(RealtimeService.class);

    private final ObjectMapper mapper;
    private final Map<String, Set<WebSocketSession>> topics = new ConcurrentHashMap<>();

    public RealtimeService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public static String matchTopic(Object matchId) {
        return "match:" + matchId;
    }

    public static String userTopic(UUID userId) {
        return "me:" + userId;
    }

    public static final String STANDINGS_TOPIC = "standings";

    public void subscribe(String topic, WebSocketSession session) {
        topics.computeIfAbsent(topic, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void unsubscribeAll(WebSocketSession session) {
        topics.values().forEach(set -> set.remove(session));
    }

    /** Broadcast an event envelope {@code { event, data }} to every subscriber of a topic. */
    public void publish(String topic, String event, Object data) {
        Set<WebSocketSession> sessions = topics.get(topic);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        String json;
        try {
            json = mapper.writeValueAsString(Map.of("event", event, "topic", topic, "data", data));
        } catch (IOException e) {
            log.warn("Failed to serialize realtime event {}", event, e);
            return;
        }
        TextMessage message = new TextMessage(json);
        for (WebSocketSession s : sessions) {
            try {
                if (s.isOpen()) {
                    synchronized (s) {
                        s.sendMessage(message);
                    }
                }
            } catch (IOException e) {
                log.debug("Drop dead session {}", s.getId());
                sessions.remove(s);
            }
        }
    }

    // ---- convenience emitters used by the scoring engine & services ----

    public void publishMatchUpdate(Object matchId, Object payload) {
        publish(matchTopic(matchId), "match.update", payload);
    }

    public void publishStandings(Object payload) {
        publish(STANDINGS_TOPIC, "standings.update", payload);
    }

    public void publishToUser(UUID userId, String event, Object payload) {
        publish(userTopic(userId), event, payload);
    }
}
