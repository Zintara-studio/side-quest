package com.sidequest.arena;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end tests over the real servlet container (so the {@code /v1} context path applies),
 * against the seeded H2 dev database. Exercises the auth/token flow, role-based access control,
 * public catalog reads, the scoring engine, and the error envelope.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(OrderAnnotation.class)
class SideQuestApiIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    ObjectMapper mapper;

    // TestRestTemplate's root URI already includes the server context path (/v1), so paths here
    // are context-relative.
    private static final String BASE = "";

    @BeforeEach
    void configureClient() {
        // Use Apache HttpClient5 so 401/4xx responses to POSTs are handled cleanly (the default JDK
        // client throws "cannot retry due to server authentication, in streaming mode" on 401 POSTs).
        rest.getRestTemplate().setRequestFactory(new HttpComponentsClientHttpRequestFactory());
    }

    // ---------- helpers ----------

    private JsonNode get(String path, String token) {
        ResponseEntity<String> res = rest.exchange(BASE + path, HttpMethod.GET,
                new HttpEntity<>(headers(token)), String.class);
        return parse(res);
    }

    private ResponseEntity<String> post(String path, Object body, String token) {
        return rest.exchange(BASE + path, HttpMethod.POST,
                new HttpEntity<>(body, headers(token)), String.class);
    }

    private ResponseEntity<String> patch(String path, Object body, String token) {
        return rest.exchange(BASE + path, HttpMethod.PATCH,
                new HttpEntity<>(body, headers(token)), String.class);
    }

    private HttpHeaders headers(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            h.setBearerAuth(token);
        }
        return h;
    }

    private JsonNode parse(ResponseEntity<String> res) {
        try {
            return res.getBody() == null ? mapper.createObjectNode() : mapper.readTree(res.getBody());
        } catch (Exception e) {
            throw new RuntimeException("Bad JSON: " + res.getBody(), e);
        }
    }

    private String login(String identifier, String password) {
        ObjectNode body = mapper.createObjectNode();
        body.put("identifier", identifier);
        body.put("password", password);
        ResponseEntity<String> res = post("/auth/login", body, null);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return parse(res).get("accessToken").asText();
    }

    // ---------- tests ----------

    @Test
    @Order(1)
    void contextLoadsAndSeedsCatalog() {
        JsonNode games = get("/games", null);
        assertThat(games.isArray()).isTrue();
        assertThat(games).hasSizeGreaterThanOrEqualTo(4);
        // Valorant should be among the seeded titles.
        boolean hasValorant = false;
        for (JsonNode g : games) {
            if ("Valorant".equals(g.get("name").asText())) {
                hasValorant = true;
            }
        }
        assertThat(hasValorant).isTrue();
    }

    @Test
    @Order(2)
    void publicCatalogReadsDoNotRequireAuth() {
        assertThat(get("/franchises", null).get("items").isArray()).isTrue();
        assertThat(get("/players", null).get("items").isArray()).isTrue();
        assertThat(get("/matches", null).get("items").isArray()).isTrue();
        assertThat(get("/announcements", null).get("items").isArray()).isTrue();
        assertThat(get("/standings", null).get("standings").isArray()).isTrue();
    }

    @Test
    @Order(3)
    void seededStandingsRankRxgFirst() {
        JsonNode standings = get("/standings", null).get("standings");
        assertThat(standings).isNotEmpty();
        JsonNode top = standings.get(0);
        assertThat(top.get("rank").asInt()).isEqualTo(1);
        // RXG won the seeded completed match → most points.
        assertThat(top.get("tag").asText()).isEqualTo("RXG");
        assertThat(top.get("points").asInt()).isGreaterThan(0);
    }

    @Test
    @Order(4)
    void adminLoginAndMe() {
        String token = login("admin@sidequest.gg", "password");
        JsonNode me = get("/auth/me", token);
        assertThat(me.get("user").get("role").asText()).isEqualTo("ADMIN");
        assertThat(me.get("user").get("email").asText()).isEqualTo("admin@sidequest.gg");
    }

    @Test
    @Order(5)
    void registerThenLoginNewPlayer() {
        String email = "rookie_" + UUID.randomUUID().toString().substring(0, 8) + "@sidequest.gg";
        ObjectNode body = mapper.createObjectNode();
        body.put("name", "Test Rookie");
        body.put("email", email);
        body.put("password", "password123");
        ResponseEntity<String> res = post("/auth/register", body, null);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode created = parse(res);
        assertThat(created.get("accessToken").asText()).isNotBlank();
        assertThat(created.get("user").get("role").asText()).isEqualTo("PLAYER");

        // and they can authenticate
        String token = login(email, "password123");
        assertThat(get("/auth/me", token).get("player")).isNotNull();
    }

    @Test
    @Order(6)
    void duplicateEmailIsRejected() {
        ObjectNode body = mapper.createObjectNode();
        body.put("name", "Dupe");
        body.put("email", "admin@sidequest.gg");
        body.put("password", "password123");
        ResponseEntity<String> res = post("/auth/register", body, null);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(parse(res).get("code").asText()).isEqualTo("EMAIL_TAKEN");
    }

    @Test
    @Order(7)
    void rbacGuardsFranchiseCreation() {
        ObjectNode body = mapper.createObjectNode();
        body.put("name", "Should Fail FC");
        body.put("tag", "SFFC");

        // anonymous → 401
        assertThat(post("/franchises", body, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // player role → 403
        String playerToken = login("raghavan@sidequest.gg", "password");
        assertThat(post("/franchises", body, playerToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // admin → 201
        String adminToken = login("admin@sidequest.gg", "password");
        ResponseEntity<String> ok = post("/franchises", body, adminToken);
        assertThat(ok.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    @Order(8)
    void errorEnvelopeOnNotFound() {
        ResponseEntity<String> res = rest.getForEntity(BASE + "/players/" + UUID.randomUUID(), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        JsonNode body = parse(res);
        assertThat(body.get("code").asText()).isEqualTo("NOT_FOUND");
        assertThat(body.get("message").asText()).isNotBlank();
        assertThat(body.has("timestamp")).isTrue();
    }

    @Test
    @Order(9)
    void scoringEngineRecomputesOnResultPublish() {
        String admin = login("admin@sidequest.gg", "password");

        // pick a game and two franchises
        String gameId = get("/games", null).get(0).get("id").asText();
        JsonNode franchises = get("/franchises", null).get("items");
        String fA = franchises.get(0).get("id").asText();
        String fB = franchises.get(1).get("id").asText();

        // schedule a match
        ObjectNode create = mapper.createObjectNode();
        create.put("gameId", gameId);
        create.put("scheduledAt", "2026-07-01T18:00:00Z");
        create.put("arena", "Test Arena");
        create.put("format", "Bo1");
        create.putArray("participantFranchiseIds").add(fA).add(fB);
        ResponseEntity<String> created = post("/matches", create, admin);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String matchId = parse(created).get("id").asText();

        // publish results: fB wins with more total
        ObjectNode results = mapper.createObjectNode();
        var rows = results.putArray("rows");
        ObjectNode r1 = rows.addObject();
        r1.put("franchiseId", fA);
        r1.put("kills", 5);
        r1.put("placePts", 4);
        ObjectNode r2 = rows.addObject();
        r2.put("franchiseId", fB);
        r2.put("kills", 20);
        r2.put("placePts", 15);
        ResponseEntity<String> published = post("/matches/" + matchId + "/results", results, admin);
        assertThat(published.getStatusCode().is2xxSuccessful()).isTrue();

        // leaderboard ranks fB first (35 total > 9 total)
        JsonNode lb = get("/matches/" + matchId + "/leaderboard", null);
        assertThat(lb.get(0).get("franchiseId").asText()).isEqualTo(fB);
        assertThat(lb.get(0).get("rank").asInt()).isEqualTo(1);
        assertThat(lb.get(0).get("total").asInt()).isEqualTo(35);

        // match is now completed
        assertThat(get("/matches/" + matchId, null).get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    @Order(10)
    void refreshTokenRotationInvalidatesOldToken() {
        ObjectNode body = mapper.createObjectNode();
        body.put("identifier", "admin@sidequest.gg");
        body.put("password", "password");
        JsonNode tokens = parse(post("/auth/login", body, null));
        String oldRefresh = tokens.get("refreshToken").asText();

        ObjectNode refreshBody = mapper.createObjectNode();
        refreshBody.put("refreshToken", oldRefresh);
        ResponseEntity<String> rotated = post("/auth/refresh", refreshBody, null);
        assertThat(rotated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(parse(rotated).get("accessToken").asText()).isNotBlank();

        // reusing the old (now revoked) refresh token fails
        ResponseEntity<String> reused = post("/auth/refresh", refreshBody, null);
        assertThat(reused.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @Order(11)
    void adminOverviewReportsKpis() {
        String admin = login("admin@sidequest.gg", "password");
        JsonNode overview = get("/admin/overview", admin);
        assertThat(overview.get("totals").get("players").asInt()).isGreaterThan(0);
        assertThat(overview.has("pendingRegistrations")).isTrue();
        assertThat(overview.has("openDisputes")).isTrue();
    }
}
