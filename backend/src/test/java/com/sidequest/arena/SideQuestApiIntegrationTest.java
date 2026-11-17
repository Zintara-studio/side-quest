package com.sidequest.arena;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import com.sidequest.arena.email.EmailSender;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end tests over the real servlet container (so the {@code /v1} context path applies),
 * against the seeded H2 dev database. Exercises the auth/token flow, role-based access control,
 * public catalog reads, the scoring engine, and the error envelope.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(SideQuestApiIntegrationTest.TestEmailConfig.class)
@TestMethodOrder(OrderAnnotation.class)
class SideQuestApiIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    RecordingEmailSender emails;

    /** Test-only email transport that captures the 6-digit OTP so tests can read it. */
    @TestConfiguration
    static class TestEmailConfig {
        @Bean
        @Primary
        RecordingEmailSender recordingEmailSender() {
            return new RecordingEmailSender();
        }
    }

    static class RecordingEmailSender implements EmailSender {
        private final Map<String, String> lastCode = new ConcurrentHashMap<>();

        @Override
        public void send(String to, String subject, String body) {
            Matcher m = Pattern.compile("\\d{6}").matcher(body);
            if (m.find()) {
                lastCode.put(to.trim().toLowerCase(), m.group());
            }
        }

        String codeFor(String email) {
            return lastCode.get(email.trim().toLowerCase());
        }
    }

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

    private ResponseEntity<String> put(String path, Object body, String token) {
        return rest.exchange(BASE + path, HttpMethod.PUT,
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

    private ResponseEntity<String> getResp(String path, String token) {
        return rest.exchange(BASE + path, HttpMethod.GET, new HttpEntity<>(headers(token)), String.class);
    }

    private ResponseEntity<String> delete(String path, String token) {
        return rest.exchange(BASE + path, HttpMethod.DELETE, new HttpEntity<>(headers(token)), String.class);
    }

    private String franchiseIdByTag(String tag) {
        for (JsonNode f : get("/franchises", null).get("items")) {
            if (tag.equals(f.get("tag").asText())) {
                return f.get("id").asText();
            }
        }
        return null;
    }

    private boolean hasNotificationType(String token, String type) {
        for (JsonNode n : get("/notifications", token)) {
            if (type.equals(n.get("type").asText())) {
                return true;
            }
        }
        return false;
    }

    /** A franchise's current league points from the public standings (0 if not ranked). */
    private int pointsOf(String franchiseId) {
        for (JsonNode s : get("/standings", null).get("standings")) {
            if (franchiseId.equals(s.get("franchiseId").asText())) {
                return s.get("points").asInt();
            }
        }
        return 0;
    }

    /** Create a fixture (future) for RXG+MOTI and publish a result where RXG wins big. Returns match id. */
    private String createAndPublishRxgWin(String admin) {
        String gameId = get("/games", null).get(0).get("id").asText();
        String rxg = franchiseIdByTag("RXG");
        String moti = franchiseIdByTag("MOTI");
        ObjectNode create = mapper.createObjectNode();
        create.put("gameId", gameId);
        create.put("scheduledAt", Instant.now().plus(Duration.ofDays(2)).toString());
        create.put("matchType", "FRANCHISE");
        create.putArray("participantFranchiseIds").add(rxg).add(moti);
        String matchId = parse(post("/matches", create, admin)).get("id").asText();
        ObjectNode results = mapper.createObjectNode();
        var rows = results.putArray("rows");
        rows.addObject().put("franchiseId", rxg).put("kills", 30).put("placePts", 15);
        rows.addObject().put("franchiseId", moti).put("kills", 2).put("placePts", 2);
        assertThat(post("/matches/" + matchId + "/results", results, admin).getStatusCode().is2xxSuccessful())
                .isTrue();
        return matchId;
    }

    private String playerIdOf(String token) {
        return get("/auth/me", token).get("player").get("id").asText();
    }

    private String franchiseIdOf(String token) {
        return get("/auth/me", token).get("player").get("franchiseId").asText();
    }

    /** A 1x1 transparent PNG, base64-encoded (valid magic bytes for the upload sniff). */
    private static final String PNG_1x1 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

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
    void registerVerifyThenLoginNewPlayer() {
        String email = "rookie_" + UUID.randomUUID().toString().substring(0, 8) + "@sidequest.gg";
        ObjectNode body = mapper.createObjectNode();
        // Username: no spaces (enforced by UsernameRules), unique per run to avoid case-insensitive clashes.
        body.put("name", "TestRookie_" + email.substring(7, 15));
        body.put("email", email);
        body.put("password", "password123");

        // 1) register: no session, verification required
        ResponseEntity<String> res = post("/auth/register", body, null);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(parse(res).get("verificationRequired").asBoolean()).isTrue();

        // 2) login before verifying is blocked with a distinct code
        ObjectNode creds = mapper.createObjectNode();
        creds.put("identifier", email);
        creds.put("password", "password123");
        ResponseEntity<String> early = post("/auth/login", creds, null);
        assertThat(early.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(parse(early).get("code").asText()).isEqualTo("EMAIL_NOT_VERIFIED");

        // 3) verify with the emailed OTP → session issued
        String code = emails.codeFor(email);
        assertThat(code).matches("\\d{6}");
        ObjectNode verify = mapper.createObjectNode();
        verify.put("email", email);
        verify.put("code", code);
        ResponseEntity<String> verified = post("/auth/verify-email", verify, null);
        assertThat(verified.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(parse(verified).get("accessToken").asText()).isNotBlank();

        // 4) now login works and the player was promoted to VERIFIED by email verification
        String token = login(email, "password123");
        JsonNode me = get("/auth/me", token);
        assertThat(me.get("player")).isNotNull();
        assertThat(me.get("player").get("status").asText()).isEqualTo("VERIFIED");
    }

    @Test
    @Order(30)
    void otpWrongCodeReplayAndForgotPassword() {
        String email = "otp_" + UUID.randomUUID().toString().substring(0, 8) + "@sidequest.gg";
        ObjectNode reg = mapper.createObjectNode();
        // Username: no spaces (UsernameRules), unique per run.
        reg.put("name", "OTPTester_" + email.substring(4, 12));
        reg.put("email", email);
        reg.put("password", "password123");
        assertThat(post("/auth/register", reg, null).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        String code = emails.codeFor(email);

        // wrong code is rejected with a generic 400
        ObjectNode wrong = mapper.createObjectNode();
        wrong.put("email", email);
        wrong.put("code", code.equals("000000") ? "111111" : "000000");
        assertThat(post("/auth/verify-email", wrong, null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // correct code works once
        ObjectNode right = mapper.createObjectNode();
        right.put("email", email);
        right.put("code", code);
        assertThat(post("/auth/verify-email", right, null).getStatusCode()).isEqualTo(HttpStatus.OK);

        // replaying the same (consumed) code fails
        assertThat(post("/auth/verify-email", right, null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // forgot-password never leaks existence (204 for unknown and known emails alike)
        ObjectNode unknown = mapper.createObjectNode();
        unknown.put("email", "nobody_" + UUID.randomUUID() + "@nowhere.test");
        assertThat(post("/auth/forgot-password", unknown, null).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        ObjectNode known = mapper.createObjectNode();
        known.put("email", email);
        assertThat(post("/auth/forgot-password", known, null).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // reset with the emailed code, then the new password logs in and the old one fails
        String resetCode = emails.codeFor(email);
        ObjectNode reset = mapper.createObjectNode();
        reset.put("email", email);
        reset.put("code", resetCode);
        reset.put("newPassword", "brandNewPass1");
        assertThat(post("/auth/reset-password", reset, null).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(login(email, "brandNewPass1")).isNotBlank();
        ObjectNode oldCreds = mapper.createObjectNode();
        oldCreds.put("identifier", email);
        oldCreds.put("password", "password123");
        assertThat(post("/auth/login", oldCreds, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
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

        // schedule a match (in the future — matches can no longer be scheduled in the past)
        ObjectNode create = mapper.createObjectNode();
        create.put("gameId", gameId);
        create.put("scheduledAt", Instant.now().plus(Duration.ofDays(7)).toString());
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

    // ---------- Phase 4: per-game scoring config + weight, franchise roster tags ----------

    /**
     * Per-game scoring config is publicly visible and admin-editable; changing a game's standings weight
     * re-weights that title's contribution to the LIVE current-season franchise table (up when heavier,
     * gone when zeroed) — a bad placement ladder is rejected.
     */
    @Test
    @Order(43)
    void perGameScoringConfigAndWeight() {
        String admin = login("admin@sidequest.gg", "password");
        String rxg = franchiseIdByTag("RXG");
        JsonNode games = get("/games", null);
        String gameId = games.get(0).get("id").asText();
        // Scoring config surfaces publicly.
        assertThat(games.get(0).has("pointsPerKill")).isTrue();
        assertThat(games.get(0).has("placementPoints")).isTrue();
        assertThat(games.get(0).has("standingsWeight")).isTrue();

        ObjectNode w = mapper.createObjectNode();
        w.put("standingsWeight", 100);
        assertThat(patch("/games/" + gameId, w, admin).getStatusCode()).isEqualTo(HttpStatus.OK);

        createAndPublishRxgWin(admin); // publishes a games[0] result for RXG
        int p100 = pointsOf(rxg);

        // Double the weight → this title's contribution doubles → RXG's live points rise.
        w.put("standingsWeight", 200);
        assertThat(parse(patch("/games/" + gameId, w, admin)).get("standingsWeight").asInt()).isEqualTo(200);
        assertThat(pointsOf(rxg)).isGreaterThan(p100);

        // Zero the weight → this title contributes nothing → live points drop below the 1.00× baseline.
        w.put("standingsWeight", 0);
        assertThat(patch("/games/" + gameId, w, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pointsOf(rxg)).isLessThan(p100);

        // A malformed placement ladder is rejected.
        ObjectNode badLadder = mapper.createObjectNode();
        badLadder.put("placementPoints", "10,abc,5");
        assertThat(patch("/games/" + gameId, badLadder, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // An out-of-range weight is rejected up front (bounded so it can't overflow the standings math).
        ObjectNode hugeWeight = mapper.createObjectNode();
        hugeWeight.put("standingsWeight", 2_000_000_000);
        assertThat(patch("/games/" + gameId, hugeWeight, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ObjectNode negWeight = mapper.createObjectNode();
        negWeight.put("standingsWeight", -5);
        assertThat(patch("/games/" + gameId, negWeight, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Restore the baseline weight so later reads aren't skewed.
        w.put("standingsWeight", 100);
        assertThat(patch("/games/" + gameId, w, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    /** Franchise-private roster tags: set by the franchise's leadership, hidden from everyone else. */
    @Test
    @Order(44)
    void rosterPlayerTagsLeaderScoped() {
        String vortex = login("vortex@sidequest.gg", "password");   // RXG owner
        String echo = login("echo@sidequest.gg", "password");       // MOTI owner (other franchise)
        String raghavan = login("raghavan@sidequest.gg", "password"); // RXG plain member
        String rxg = franchiseIdOf(vortex);
        String raghavanId = playerIdOf(raghavan);

        // Owner sets tags (with a case-duplicate that gets de-duped).
        ObjectNode body = mapper.createObjectNode();
        body.putArray("tags").add("Valorant 1").add("BGMI 2").add("valorant 1");
        assertThat(putTags(rxg, raghavanId, body, vortex).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(tagsFor(get("/franchises/" + rxg + "/roster", vortex), raghavanId))
                .containsExactly("Valorant 1", "BGMI 2");

        // Hidden from spectators and other franchises' leaders.
        assertThat(tagsFor(get("/franchises/" + rxg + "/roster", null), raghavanId)).isNull();
        assertThat(tagsFor(get("/franchises/" + rxg + "/roster", echo), raghavanId)).isNull();

        // A plain roster member or another franchise's owner can't set tags.
        assertThat(putTags(rxg, raghavanId, body, raghavan).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(putTags(rxg, raghavanId, body, echo).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // Oversized payloads are rejected up front (list cap 20, per-tag cap 40 chars).
        ObjectNode tooMany = mapper.createObjectNode();
        var many = tooMany.putArray("tags");
        for (int i = 0; i < 21; i++) {
            many.add("tag " + i);
        }
        assertThat(putTags(rxg, raghavanId, tooMany, vortex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ObjectNode tooLong = mapper.createObjectNode();
        tooLong.putArray("tags").add("x".repeat(41));
        assertThat(putTags(rxg, raghavanId, tooLong, vortex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private ResponseEntity<String> putTags(String franchiseId, String playerId, ObjectNode body, String token) {
        return rest.exchange(BASE + "/franchises/" + franchiseId + "/roster/" + playerId + "/tags",
                HttpMethod.PUT, new HttpEntity<>(body, headers(token)), String.class);
    }

    /** The tags list for a player in a roster payload, or null when the field is absent/hidden. */
    private List<String> tagsFor(JsonNode roster, String playerId) {
        for (JsonNode m : roster) {
            if (playerId.equals(m.get("playerId").asText())) {
                JsonNode t = m.get("tags");
                if (t == null || t.isNull()) {
                    return null;
                }
                List<String> out = new ArrayList<>();
                t.forEach(x -> out.add(x.asText()));
                return out;
            }
        }
        return null;
    }

    /**
     * Locking the auction pool must have the same public effect as an admin closing the AUCTION
     * registration call from the announcements page: the call flips registrationOpen=false (Register
     * button gone) AND new pool applies are rejected. Runs after every test that enters the pool
     * (locking is one-way for the seeded auction).
     */
    @Test
    @Order(46)
    void lockPoolClosesAuctionRegistrationCall() {
        String admin = login("admin@sidequest.gg", "password");
        String blitz = login("blitz@sidequest.gg", "password"); // free agent already in the pool

        // The seeded AUCTION registration call starts open.
        assertThat(auctionCallOpen()).isTrue();

        String auctionId = get("/auctions/active", null).get("id").asText();
        assertThat(post("/auctions/" + auctionId + "/lock-pool", null, admin).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        // The call auto-closed — same effect as Close registration — and new applies are rejected.
        assertThat(auctionCallOpen()).isFalse();
        ObjectNode apply = mapper.createObjectNode();
        apply.put("type", "AUCTION");
        apply.putArray("games").add("Valorant");
        assertThat(post("/registrations", apply, blitz).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    /** Whether any AUCTION-type registration call is currently open. */
    private boolean auctionCallOpen() {
        for (JsonNode a : get("/announcements?limit=100", null).get("items")) {
            if ("AUCTION".equals(a.path("registrationType").asText())
                    && a.path("registrationOpen").asBoolean()) {
                return true;
            }
        }
        return false;
    }

    /**
     * A match belonging to a FINISHED season is frozen history — it can no longer be voided (cancel or
     * delete), since the recompute engine deliberately never rewrites finished-season standings, so a
     * void would leave the frozen snapshot permanently over-crediting the fixture. Runs LAST (@Order 90)
     * because it finishes the active season, a one-way global state change.
     */
    @Test
    @Order(90)
    void finishedSeasonMatchCannotBeVoided() {
        String admin = login("admin@sidequest.gg", "password");
        String matchId = createAndPublishRxgWin(admin);

        // Finish the active season → the match now belongs to frozen history.
        assertThat(post("/seasons/finish", null, admin).getStatusCode().is2xxSuccessful()).isTrue();

        // Cancel and delete are both refused for the now-historical fixture.
        ObjectNode toCancelled = mapper.createObjectNode();
        toCancelled.put("status", "CANCELLED");
        assertThat(patch("/matches/" + matchId, toCancelled, admin).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(delete("/matches/" + matchId, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
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

    // ---------- Phase 2: profiles, per-field privacy, media, autofill ----------

    /**
     * The per-field privacy matrix: a player's private contact fields (realName/phone/contactEmail,
     * seeded private) are visible to the owner, an admin, and the player's own franchise owner/manager,
     * but NULL to spectators and to leaders of OTHER franchises.
     */
    @Test
    @Order(20)
    void profileContactPrivacyMatrix() {
        String raghavan = login("raghavan@sidequest.gg", "password"); // RXG member (target)
        String vortex = login("vortex@sidequest.gg", "password");     // RXG OWNER (same franchise)
        String echo = login("echo@sidequest.gg", "password");         // MOTI owner (other franchise)
        String admin = login("admin@sidequest.gg", "password");
        String raghavanId = playerIdOf(raghavan);

        // Spectator (no token): private fields are stripped to null; public fields still present.
        JsonNode asSpectator = get("/players/" + raghavanId, null);
        assertThat(asSpectator.get("gamerTag").asText()).isEqualTo("Raghavan");
        assertThat(hidden(asSpectator, "realName")).isTrue();
        assertThat(hidden(asSpectator, "phone")).isTrue();
        assertThat(hidden(asSpectator, "contactEmail")).isTrue();
        // The visibility flags themselves are non-sensitive and always present.
        assertThat(asSpectator.get("realNamePublic").asBoolean()).isFalse();

        // Owner sees their own private fields.
        assertThat(get("/players/" + raghavanId, raghavan).get("realName").asText()).contains("real name");
        // Admin sees everything.
        assertThat(get("/players/" + raghavanId, admin).hasNonNull("phone")).isTrue();
        // Same-franchise owner (RXG) sees their roster member's private fields.
        assertThat(get("/players/" + raghavanId, vortex).get("contactEmail").asText())
                .isEqualTo("raghavan@sidequest.gg");
        // A leader of a DIFFERENT franchise (MOTI) is treated as a spectator for this player.
        assertThat(hidden(get("/players/" + raghavanId, echo), "realName")).isTrue();
    }

    /**
     * A player can flip a game handle to private via the profile edit (the shared writer), and rating
     * updates land — spectators then stop seeing that handle while the owner still does.
     */
    @Test
    @Order(21)
    void selfProfileEditTogglesHandlePrivacyAndRating() {
        String raghavan = login("raghavan@sidequest.gg", "password");
        String raghavanId = playerIdOf(raghavan);
        String valorantId = null;
        for (JsonNode g : get("/games", null)) {
            if ("Valorant".equals(g.get("name").asText())) {
                valorantId = g.get("id").asText();
            }
        }
        assertThat(valorantId).isNotNull();

        // Baseline: the Valorant handle is public (spectator can see it).
        assertThat(handleVisible(get("/players/" + raghavanId + "/usernames", null), "RXG_Raghavan")).isTrue();

        // Self edit: bump the rating and make the Valorant handle private.
        ObjectNode edit = mapper.createObjectNode();
        var profs = edit.putArray("proficiencies");
        ObjectNode entry = profs.addObject();
        entry.put("gameId", valorantId);
        entry.put("rating", 97);
        entry.put("handle", "RXG_Raghavan");
        entry.put("handlePublic", false);
        assertThat(patch("/players/" + raghavanId, edit, raghavan).getStatusCode()).isEqualTo(HttpStatus.OK);

        // Spectator no longer sees the now-private handle; the owner still does.
        assertThat(handleVisible(get("/players/" + raghavanId + "/usernames", null), "RXG_Raghavan")).isFalse();
        assertThat(handleVisible(get("/players/" + raghavanId + "/usernames", raghavan), "RXG_Raghavan")).isTrue();

        // Rating update landed (visible publicly on the profile).
        boolean sawRating = false;
        for (JsonNode p : get("/players/" + raghavanId, null).get("proficiencies")) {
            if (valorantId.equals(p.get("gameId").asText())) {
                assertThat(p.get("rating").asInt()).isEqualTo(97);
                sawRating = true;
            }
        }
        assertThat(sawRating).isTrue();

        // A player cannot edit someone else's profile.
        String vortex = login("vortex@sidequest.gg", "password");
        assertThat(patch("/players/" + raghavanId, edit, vortex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    private static boolean handleVisible(JsonNode usernames, String handle) {
        for (JsonNode u : usernames) {
            if (handle.equals(u.get("handle").asText())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Whether a field is absent/null. The API serialises with {@code non_null} inclusion, so a stripped
     * (private, nulled) field is OMITTED from the JSON entirely — {@code node.get(field)} returns Java
     * null rather than a NullNode.
     */
    private static boolean hidden(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull();
    }

    /**
     * The roster endpoint exposes members' private contact fields only to that franchise's leadership
     * or an admin — never to spectators or to another franchise's owner.
     */
    @Test
    @Order(22)
    void rosterPrivateFieldsAreLeaderScoped() {
        String vortex = login("vortex@sidequest.gg", "password"); // RXG owner
        String echo = login("echo@sidequest.gg", "password");     // MOTI owner
        String rxgId = franchiseIdOf(vortex);

        // Spectator: contact fields null for every roster member.
        for (JsonNode m : get("/franchises/" + rxgId + "/roster", null)) {
            assertThat(hidden(m, "realName")).isTrue();
            assertThat(hidden(m, "phone")).isTrue();
        }
        // RXG owner: contact fields populated.
        boolean sawPrivate = false;
        for (JsonNode m : get("/franchises/" + rxgId + "/roster", vortex)) {
            if (m.hasNonNull("realName")) {
                sawPrivate = true;
            }
        }
        assertThat(sawPrivate).isTrue();
        // Other franchise's owner: still stripped (cross-franchise peek blocked).
        for (JsonNode m : get("/franchises/" + rxgId + "/roster", echo)) {
            assertThat(hidden(m, "realName")).isTrue();
        }
    }

    /** Media upload: validates type + size, stores the bytes, and serves them back publicly. */
    @Test
    @Order(23)
    void mediaUploadValidatesAndServes() {
        String raghavan = login("raghavan@sidequest.gg", "password");

        // Unauthenticated upload is rejected.
        ObjectNode good = mapper.createObjectNode();
        good.put("data", PNG_1x1);
        good.put("kind", "avatar");
        assertThat(post("/media", good, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // Valid PNG stored → returns a /media/{id} url.
        ResponseEntity<String> up = post("/media", good, raghavan);
        assertThat(up.getStatusCode()).isEqualTo(HttpStatus.OK);
        String url = parse(up).get("url").asText();
        assertThat(url).startsWith("/media/");

        // The bytes are served publicly with the sniffed content type.
        ResponseEntity<byte[]> served = rest.exchange(BASE + url, HttpMethod.GET,
                new HttpEntity<>(headers(null)), byte[].class);
        assertThat(served.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(served.getHeaders().getContentType().toString()).isEqualTo("image/png");
        assertThat(served.getBody().length).isGreaterThan(0);

        // Non-image bytes are rejected.
        ObjectNode notImage = mapper.createObjectNode();
        notImage.put("data", "AAAAAAAA"); // valid base64, not an image
        notImage.put("kind", "avatar");
        assertThat(post("/media", notImage, raghavan).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Oversized avatar (> 32KB decoded) is rejected before it is even stored.
        ObjectNode tooBig = mapper.createObjectNode();
        tooBig.put("data", "A".repeat(60_000)); // ~45KB decoded > 32KB avatar cap
        tooBig.put("kind", "avatar");
        assertThat(post("/media", tooBig, raghavan).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Setting the avatar via the profile PATCH persists the url.
        ObjectNode setAvatar = mapper.createObjectNode();
        setAvatar.put("avatarUrl", url);
        String raghavanId = playerIdOf(raghavan);
        assertThat(patch("/players/" + raghavanId, setAvatar, raghavan).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/players/" + raghavanId, null).get("avatarUrl").asText()).isEqualTo(url);

        // An arbitrary external / data URL is rejected — only server-issued /media refs are accepted
        // (otherwise a profile becomes a tracking beacon for every viewer).
        ObjectNode extAvatar = mapper.createObjectNode();
        extAvatar.put("avatarUrl", "https://evil.example/track.png");
        assertThat(patch("/players/" + raghavanId, extAvatar, raghavan).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        ObjectNode dataAvatar = mapper.createObjectNode();
        dataAvatar.put("avatarUrl", "data:image/png;base64,AAAA");
        assertThat(patch("/players/" + raghavanId, dataAvatar, raghavan).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        // A base64 payload beyond the DTO cap is rejected (defence-in-depth against giant request bodies).
        ObjectNode hugeData = mapper.createObjectNode();
        hugeData.put("data", "A".repeat(400_001));
        hugeData.put("kind", "avatar");
        assertThat(post("/media", hugeData, raghavan).getStatusCode().is4xxClientError()).isTrue();
    }

    /**
     * Regression guard for the shared writer: re-entering the auction pool with a proficiency line that
     * carries NO handle must not silently re-publicize a handle the player deliberately set private.
     */
    @Test
    @Order(25)
    void auctionEntryDoesNotRepublicizePrivateHandle() {
        String blitz = login("blitz@sidequest.gg", "password"); // VERIFIED, no franchise
        String blitzId = playerIdOf(blitz);
        String valorantId = null;
        for (JsonNode g : get("/games", null)) {
            if ("Valorant".equals(g.get("name").asText())) valorantId = g.get("id").asText();
        }
        assertThat(valorantId).isNotNull();

        // 1) set a PRIVATE handle via profile edit
        ObjectNode edit = mapper.createObjectNode();
        var profs = edit.putArray("proficiencies");
        ObjectNode e = profs.addObject();
        e.put("gameId", valorantId);
        e.put("rating", 70);
        e.put("handle", "BlitzSecret");
        e.put("handlePublic", false);
        assertThat(patch("/players/" + blitzId, edit, blitz).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(handleVisible(get("/players/" + blitzId + "/usernames", null), "BlitzSecret")).isFalse();

        // 2) enter the auction pool with a proficiency for the SAME game but NO handle
        ObjectNode apply = mapper.createObjectNode();
        apply.put("type", "AUCTION");
        apply.putArray("games").add("Valorant");
        ObjectNode ap = apply.putArray("proficiencies").addObject();
        ap.put("gameId", valorantId);
        ap.put("rating", 75);
        ResponseEntity<String> reg = post("/registrations", apply, blitz);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // 3) the handle must STILL be private (spectator can't see it; owner still can)
        assertThat(handleVisible(get("/players/" + blitzId + "/usernames", null), "BlitzSecret")).isFalse();
        assertThat(handleVisible(get("/players/" + blitzId + "/usernames", blitz), "BlitzSecret")).isTrue();
    }

    /**
     * Player self-service withdrawal: cancelling your own registration marks it WITHDRAWN (a neutral
     * void, NOT the punitive REJECTED) and frees you to re-enter; you can't cancel someone else's.
     * Runs after @Order 25 (which put blitz in the auction pool) and before the pool lock @Order 46.
     */
    @Test
    @Order(26)
    void playerCanWithdrawOwnRegistration() {
        String blitz = login("blitz@sidequest.gg", "password");
        // Find blitz's live AUCTION entry created at @Order 25.
        String regId = null;
        for (JsonNode r : get("/registrations/mine", blitz)) {
            if ("AUCTION".equals(r.path("type").asText()) && "ACTIVE".equals(r.path("status").asText())) {
                regId = r.get("id").asText();
            }
        }
        assertThat(regId).isNotNull();

        // Withdraw it → 200, and it becomes WITHDRAWN (neutral), not REJECTED.
        assertThat(post("/registrations/" + regId + "/cancel", null, blitz).getStatusCode()).isEqualTo(HttpStatus.OK);
        String finalRegId = regId;
        boolean withdrawn = false;
        for (JsonNode r : get("/registrations/mine", blitz)) {
            if (r.get("id").asText().equals(finalRegId)) {
                withdrawn = "WITHDRAWN".equals(r.path("status").asText());
            }
        }
        assertThat(withdrawn).isTrue();

        // Withdrawing freed the pool slot — blitz can re-enter.
        ObjectNode reapply = mapper.createObjectNode();
        reapply.put("type", "AUCTION");
        reapply.putArray("games").add("Valorant");
        assertThat(post("/registrations", reapply, blitz).getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // A different player can't cancel blitz's registration.
        String raghavan = login("raghavan@sidequest.gg", "password");
        assertThat(post("/registrations/" + finalRegId + "/cancel", null, raghavan).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ---------- Phase 3: match lifecycle, room, and notifications ----------

    /**
     * End-to-end match room lifecycle: start (→LIVE, notifies participants), participant-gated room
     * reads, admin messages, end (→AWAITING_RESULT, room closed), reschedule guards, and delete rules.
     */
    @Test
    @Order(40)
    void matchRoomLifecycleAndVisibility() {
        String admin = login("admin@sidequest.gg", "password");
        String raghavan = login("raghavan@sidequest.gg", "password"); // RXG member
        String blitz = login("blitz@sidequest.gg", "password");        // verified, no franchise (non-participant)
        String gameId = get("/games", null).get(0).get("id").asText();
        String rxg = franchiseIdByTag("RXG");
        String moti = franchiseIdByTag("MOTI");
        String raghavanId = playerIdOf(raghavan);

        // Admin schedules a FRANCHISE fixture with RXG + MOTI.
        ObjectNode create = mapper.createObjectNode();
        create.put("gameId", gameId);
        create.put("scheduledAt", Instant.now().plus(Duration.ofDays(3)).toString());
        create.put("matchType", "FRANCHISE");
        create.putArray("participantFranchiseIds").add(rxg).add(moti);
        ResponseEntity<String> created = post("/matches", create, admin);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String matchId = parse(created).get("id").asText();

        // Field raghavan for RXG (notifies him).
        ObjectNode lineup = mapper.createObjectNode();
        lineup.putArray("playerIds").add(raghavanId);
        assertThat(rest.exchange(BASE + "/matches/" + matchId + "/lineups/" + rxg, HttpMethod.PUT,
                new HttpEntity<>(lineup, headers(admin)), String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(hasNotificationType(raghavan, "MATCH")).isTrue();

        // Before start, the room is not readable by a spectator (401) — start it.
        assertThat(getResp("/matches/" + matchId + "/room", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        ObjectNode startBody = mapper.createObjectNode();
        startBody.put("roomId", "LOBBY-9F3");
        startBody.put("venue", "Main Stage");
        ResponseEntity<String> started = post("/matches/" + matchId + "/start", startBody, admin);
        assertThat(started.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(parse(started).get("status").asText()).isEqualTo("LIVE");

        // Room visibility: participant sees the lobby code; a non-participant is forbidden; spectator 401.
        JsonNode room = get("/matches/" + matchId + "/room", raghavan);
        assertThat(room.get("live").asBoolean()).isTrue();
        assertThat(room.get("roomId").asText()).isEqualTo("LOBBY-9F3");
        assertThat(room.get("venue").asText()).isEqualTo("Main Stage");
        assertThat(getResp("/matches/" + matchId + "/room", blitz).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(getResp("/matches/" + matchId + "/room", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // The live match shows up on the participant's home "match rooms".
        boolean inMyRooms = false;
        for (JsonNode m : get("/matches/my-rooms", raghavan)) {
            if (matchId.equals(m.get("id").asText())) {
                inMyRooms = true;
            }
        }
        assertThat(inMyRooms).isTrue();

        // Admin posts a room message; the participant sees it; a non-admin cannot post.
        ObjectNode msg = mapper.createObjectNode();
        msg.put("body", "Check in on the lobby, we start in 5.");
        assertThat(post("/matches/" + matchId + "/messages", msg, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(post("/matches/" + matchId + "/messages", msg, raghavan).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        JsonNode roomAfter = get("/matches/" + matchId + "/room", raghavan);
        assertThat(roomAfter.get("messages")).hasSize(1);
        assertThat(roomAfter.get("messages").get(0).get("body").asText()).contains("lobby");

        // End the match: → AWAITING_RESULT, room closed (roomId cleared), messages can't be posted.
        assertThat(post("/matches/" + matchId + "/end", null, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/matches/" + matchId, null).get("status").asText()).isEqualTo("AWAITING_RESULT");
        JsonNode closedRoom = get("/matches/" + matchId + "/room", raghavan);
        assertThat(closedRoom.get("live").asBoolean()).isFalse();
        assertThat(hidden(closedRoom, "roomId")).isTrue();
        assertThat(post("/matches/" + matchId + "/messages", msg, admin).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        // Reschedule: a past time is rejected; a future time is accepted (still not completed).
        ObjectNode pastReschedule = mapper.createObjectNode();
        pastReschedule.put("scheduledAt", Instant.now().minus(Duration.ofDays(1)).toString());
        assertThat(post("/matches/" + matchId + "/reschedule", pastReschedule, admin).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        ObjectNode futureReschedule = mapper.createObjectNode();
        futureReschedule.put("scheduledAt", Instant.now().plus(Duration.ofDays(5)).toString());
        assertThat(post("/matches/" + matchId + "/reschedule", futureReschedule, admin).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        // Delete: a player can't; the admin can, and the fixture is gone.
        assertThat(delete("/matches/" + matchId, raghavan).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(delete("/matches/" + matchId, admin).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getResp("/matches/" + matchId, null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    /** Deleting a completed match drops its published points back out of the standings (recompute). */
    @Test
    @Order(41)
    void completedMatchDeletionRestoresStandings() {
        String admin = login("admin@sidequest.gg", "password");
        String rxg = franchiseIdByTag("RXG");
        int before = pointsOf(rxg);

        String matchId = createAndPublishRxgWin(admin);
        assertThat(pointsOf(rxg)).isGreaterThan(before); // the win added points

        // A completed match CAN be deleted (admin voiding an unfair fixture); its points drop out.
        assertThat(delete("/matches/" + matchId, admin).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getResp("/matches/" + matchId, null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(pointsOf(rxg)).isEqualTo(before); // recompute restored the prior standings
    }

    /**
     * Lifecycle state-machine guards: the generic PATCH only owns the CANCELLED transition (others must
     * go through start/end/results); a cancelled match can't be started; a published match is locked
     * against start / reschedule / schedule-edit; but it CAN be cancelled (voiding an unfair result),
     * which drops its points from the standings.
     */
    @Test
    @Order(42)
    void matchLifecycleGuards() {
        String admin = login("admin@sidequest.gg", "password");
        String gameId = get("/games", null).get(0).get("id").asText();
        String future = Instant.now().plus(Duration.ofDays(4)).toString();
        String rxg = franchiseIdByTag("RXG");

        // A fresh SCHEDULED fixture.
        ObjectNode create = mapper.createObjectNode();
        create.put("gameId", gameId);
        create.put("scheduledAt", future);
        create.put("matchType", "FRANCHISE");
        String schedId = parse(post("/matches", create, admin)).get("id").asText();

        // PATCH can't force LIVE (must use /start); it CAN cancel a scheduled fixture.
        ObjectNode toLive = mapper.createObjectNode();
        toLive.put("status", "LIVE");
        assertThat(patch("/matches/" + schedId, toLive, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ObjectNode toCancelled = mapper.createObjectNode();
        toCancelled.put("status", "CANCELLED");
        assertThat(patch("/matches/" + schedId, toCancelled, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
        // A cancelled fixture can't be started.
        assertThat(post("/matches/" + schedId + "/start", null, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // A completed fixture: start/reschedule/schedule-edit are locked, but cancel is allowed and voids
        // its standings contribution.
        int before = pointsOf(rxg);
        String completedId = createAndPublishRxgWin(admin);
        assertThat(pointsOf(rxg)).isGreaterThan(before);
        assertThat(post("/matches/" + completedId + "/start", null, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ObjectNode resched = mapper.createObjectNode();
        resched.put("scheduledAt", future);
        assertThat(post("/matches/" + completedId + "/reschedule", resched, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(patch("/matches/" + completedId, resched, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        // Cancel a completed match → 200, and its points drop back out of the standings.
        assertThat(patch("/matches/" + completedId, toCancelled, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pointsOf(rxg)).isEqualTo(before);

        // A cancelled fixture is terminal: re-publishing results can't silently resurrect it to COMPLETED.
        ObjectNode revive = mapper.createObjectNode();
        revive.putArray("rows").addObject().put("franchiseId", rxg).put("kills", 5).put("placePts", 5);
        assertThat(post("/matches/" + completedId + "/results", revive, admin).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(pointsOf(rxg)).isEqualTo(before); // still voided
    }

    /** Franchise branding (logo/banner) is self-service for the owner or an admin, forbidden otherwise. */
    @Test
    @Order(24)
    void franchiseBrandingOwnerOrAdminOnly() {
        String vortex = login("vortex@sidequest.gg", "password");  // RXG owner
        String raghavan = login("raghavan@sidequest.gg", "password"); // RXG plain member
        String rxgId = franchiseIdOf(vortex);

        ObjectNode branding = mapper.createObjectNode();
        branding.put("logoUrl", "/media/" + UUID.randomUUID());
        branding.put("bannerUrl", "/media/" + UUID.randomUUID());

        // A plain roster member (not owner/admin) cannot rebrand the franchise.
        assertThat(patch("/franchises/" + rxgId + "/branding", branding, raghavan).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        // The owner can, and the values round-trip on the detail.
        ResponseEntity<String> ok = patch("/franchises/" + rxgId + "/branding", branding, vortex);
        assertThat(ok.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode detail = get("/franchises/" + rxgId, null);
        assertThat(detail.get("logoUrl").asText()).isEqualTo(branding.get("logoUrl").asText());
        assertThat(detail.get("bannerUrl").asText()).isEqualTo(branding.get("bannerUrl").asText());
    }

    // ---------- Batch 10: admin tier, pinned announcements, auction unsold semantics ----------

    /** Register a brand-new player, verify the emailed OTP, and return a logged-in access token. */
    private String registerVerifyLogin(String email, String name) {
        ObjectNode body = mapper.createObjectNode();
        body.put("name", name);
        body.put("email", email);
        body.put("password", "password123");
        assertThat(post("/auth/register", body, null).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        String code = emails.codeFor(email);
        assertThat(code).matches("\\d{6}");
        ObjectNode verify = mapper.createObjectNode();
        verify.put("email", email);
        verify.put("code", code);
        assertThat(post("/auth/verify-email", verify, null).getStatusCode()).isEqualTo(HttpStatus.OK);
        return login(email, "password123");
    }

    /**
     * The main admin (super-admin) governs appointment and the sensitive, main-admin-only actions.
     * Appointed admins run day-to-day operations but are forbidden the undo-less levers (season
     * finish, the auction workflow, changing a game's standings weight) and cannot appoint/revoke.
     */
    @Test
    @Order(12)
    void mainAdminGovernsAppointmentAndSensitiveActions() {
        String superAdmin = login("admin@sidequest.gg", "password");
        JsonNode superMe = get("/auth/me", superAdmin);
        assertThat(superMe.get("user").get("adminLevel").asText()).isEqualTo("SUPER_ADMIN");

        // A fresh, verified player is a plain player — no control room.
        String pEmail = "appointee_" + UUID.randomUUID().toString().substring(0, 8) + "@sidequest.gg";
        String plainToken = registerVerifyLogin(pEmail, "Appointee");
        JsonNode pMe = get("/auth/me", plainToken);
        assertThat(pMe.get("user").get("adminLevel").asText()).isEqualTo("NONE");
        String pPlayerId = pMe.get("player").get("id").asText();
        assertThat(getResp("/admin/overview", plainToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // The main admin appoints the player as an admin.
        ResponseEntity<String> appoint = post("/admin/players/" + pPlayerId + "/admin", null, superAdmin);
        assertThat(appoint.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(parse(appoint).get("adminLevel").asText()).isEqualTo("ADMIN");

        // The appointee re-logs in to pick up the new tier, and keeps their PLAYER role (dual identity).
        String adminToken = login(pEmail, "password123");
        JsonNode adminMe = get("/auth/me", adminToken);
        assertThat(adminMe.get("user").get("adminLevel").asText()).isEqualTo("ADMIN");
        assertThat(adminMe.get("user").get("role").asText()).isEqualTo("PLAYER");
        assertThat(adminMe.get("player")).isNotNull(); // still a player → dual dashboard

        // Appointed admin CAN do day-to-day admin.
        assertThat(getResp("/admin/overview", adminToken).getStatusCode()).isEqualTo(HttpStatus.OK);

        // ...but is FORBIDDEN the main-admin-only actions.
        assertThat(post("/seasons/finish", null, adminToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        String auctionId = get("/auctions/active", null).get("id").asText();
        assertThat(post("/auctions/" + auctionId + "/start", null, adminToken).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        // Weight change is field-level main-admin-only (other game edits stay open to any admin).
        String gameId = get("/games", null).get(0).get("id").asText();
        ObjectNode weight = mapper.createObjectNode();
        weight.put("standingsWeight", 137);
        assertThat(patch("/games/" + gameId, weight, adminToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        // ...and cannot appoint/revoke other admins.
        assertThat(post("/admin/players/" + pPlayerId + "/admin", null, adminToken).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        // ...franchise management is main-admin-only.
        ObjectNode fr = mapper.createObjectNode();
        fr.put("name", "Appointee FC " + UUID.randomUUID().toString().substring(0, 6));
        fr.put("tag", "AFC");
        assertThat(post("/franchises", fr, adminToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        // ...and the static-config seed is main-admin-only.
        assertThat(post("/admin/seed", null, adminToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // Revoke the appointee → plain player again, control room closed (after re-login).
        assertThat(delete("/admin/players/" + pPlayerId + "/admin", superAdmin).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        String demotedToken = login(pEmail, "password123");
        assertThat(get("/auth/me", demotedToken).get("user").get("adminLevel").asText()).isEqualTo("NONE");
        assertThat(getResp("/admin/overview", demotedToken).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    /** A pinned announcement surfaces under the {@code ?pinned=true} home filter; unpinning drops it. */
    @Test
    @Order(13)
    void pinnedAnnouncementSurfacesUnderPinnedFilter() {
        String admin = login("admin@sidequest.gg", "password");
        ObjectNode body = mapper.createObjectNode();
        body.put("category", "GENERAL");
        body.put("title", "Pinned notice " + UUID.randomUUID().toString().substring(0, 8));
        body.put("body", "Important league-pinned message.");
        body.put("pinned", true);
        ResponseEntity<String> created = post("/announcements", body, admin);
        assertThat(created.getStatusCode().is2xxSuccessful()).isTrue();
        JsonNode view = parse(created);
        assertThat(view.get("pinned").asBoolean()).isTrue();
        String id = view.get("id").asText();

        assertThat(pinnedIds().contains(id)).isTrue();

        // Unpin via PATCH → drops off the pinned filter.
        ObjectNode unpin = mapper.createObjectNode();
        unpin.put("pinned", false);
        assertThat(patch("/announcements/" + id, unpin, admin).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pinnedIds().contains(id)).isFalse();
    }

    private java.util.Set<String> pinnedIds() {
        java.util.Set<String> ids = new java.util.HashSet<>();
        for (JsonNode n : get("/announcements?pinned=true", null).get("items")) {
            assertThat(n.get("pinned").asBoolean()).isTrue(); // the filter must only return pinned posts
            ids.add(n.get("id").asText());
        }
        return ids;
    }

    /**
     * Regression guard for the reported bug: marking an on-block lot UNSOLD must NOT read as a sale.
     * The just-resolved lot is flagged (status UNSOLD, no winner/leading bidder) so the client shows an
     * "unsold" card rather than re-displaying a previous sale, and the player is not acquired.
     */
    @Test
    @Order(48)
    void auctionUnsoldFlagsLastResolvedAndLeavesPlayerUnacquired() {
        String admin = login("admin@sidequest.gg", "password");
        JsonNode active = get("/auctions/active", null);
        String auctionId = active.get("id").asText();

        // The pool was locked by an earlier test; open the hall (DRAFT→LOBBY) then start (→LIVE).
        if ("DRAFT".equals(active.get("status").asText())) {
            assertThat(post("/auctions/" + auctionId + "/open-hall", null, admin).getStatusCode().is2xxSuccessful())
                    .isTrue();
        }
        ResponseEntity<String> started = post("/auctions/" + auctionId + "/start", null, admin);
        assertThat(started.getStatusCode().is2xxSuccessful()).isTrue();
        JsonNode live = parse(started);
        assertThat(live.get("status").asText()).isEqualTo("LIVE");
        JsonNode onBlock = live.get("currentLot");
        assertThat(onBlock).isNotNull();
        String lotId = onBlock.get("id").asText();
        String playerId = onBlock.get("playerId").asText();

        // Force UNSOLD (admin path — no bids/timing needed).
        ResponseEntity<String> unsold = post("/auctions/" + auctionId + "/unsold", null, admin);
        assertThat(unsold.getStatusCode().is2xxSuccessful()).isTrue();
        JsonNode after = parse(unsold);

        // The lot that triggered the intermission is the one we just unsold — and it reads UNSOLD.
        JsonNode resolved = after.get("lastResolvedLot");
        assertThat(resolved).isNotNull();
        assertThat(resolved.get("id").asText()).isEqualTo(lotId);
        assertThat(resolved.get("status").asText()).isEqualTo("UNSOLD");
        // No winner, and no stale leading bidder (the reported bug re-showed a franchise as the buyer).
        assertThat(resolved.hasNonNull("soldToTag")).isFalse();
        assertThat(resolved.hasNonNull("currentBidderTag")).isFalse();

        // The player was NOT acquired by any franchise.
        JsonNode player = get("/players/" + playerId, null);
        assertThat(player.hasNonNull("franchise")).isFalse();

        // Leave a terminal auction so later reads aren't affected.
        assertThat(post("/auctions/" + auctionId + "/complete", null, admin).getStatusCode().is2xxSuccessful())
                .isTrue();
    }

    /** gamerTag + franchise-name uniqueness, admin add-game (+ dup reject), and the static-config seed. */
    @Test
    @Order(14)
    void uniquenessAddGameAndSeed() {
        String suffix = UUID.randomUUID().toString().substring(0, 6);

        // (a) the display name doubles as the public gamerTag and must be unique site-wide.
        String name = "Dupe" + suffix;
        ObjectNode reg1 = mapper.createObjectNode();
        reg1.put("name", name);
        reg1.put("email", "dupe1-" + suffix + "@sidequest.gg");
        reg1.put("password", "password123");
        assertThat(post("/auth/register", reg1, null).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        ObjectNode reg2 = mapper.createObjectNode();
        reg2.put("name", name); // same handle
        reg2.put("email", "dupe2-" + suffix + "@sidequest.gg");
        reg2.put("password", "password123");
        assertThat(post("/auth/register", reg2, null).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        String admin = login("admin@sidequest.gg", "password");

        // (b) franchise name is unique — reusing an existing franchise's name is rejected (no new row made).
        JsonNode existingFranchise = get("/franchises", null).get("items").get(0);
        ObjectNode dupFranchise = mapper.createObjectNode();
        dupFranchise.put("name", existingFranchise.get("name").asText());
        dupFranchise.put("tag", "ZZ" + suffix.substring(0, 3));
        assertThat(post("/franchises", dupFranchise, admin).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // (c) admin can add a game; a duplicate name is rejected. Popularity is vote-driven, so a new
        // title starts at 0 (admins can't set it anymore).
        String gname = "Deadlock " + suffix;
        ObjectNode game = mapper.createObjectNode();
        game.put("name", gname);
        game.put("format", "6v6 Hero Shooter");
        game.put("gameType", "TACTICAL");
        ResponseEntity<String> created = post("/games", game, admin);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(parse(created).get("name").asText()).isEqualTo(gname);
        assertThat(parse(created).get("popularity").asInt()).isZero();
        assertThat(post("/games", game, admin).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // (d) the static-config seed is idempotent and reports the catalogue total.
        ResponseEntity<String> seed = post("/admin/seed", null, admin);
        assertThat(seed.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(parse(seed).get("gamesTotal").asInt()).isGreaterThan(0);
    }

    /**
     * NEW profile security + username rules: an admin may VIEW every field (incl. the account email)
     * but must NOT edit another player's profile; the account email is stripped for spectators;
     * username availability reflects case-insensitive uniqueness; onboarding is closed once an account
     * is set up; and a username with spaces is rejected at registration.
     */
    @Test
    @Order(49)
    void profileEditOwnerOnlyUsernameRulesAndOnboardGuard() {
        String admin = login("admin@sidequest.gg", "password");
        String raghavan = login("raghavan@sidequest.gg", "password");
        String raghavanId = playerIdOf(raghavan);

        // (a) an admin sees every field (incl. the account email) but must NOT edit another's profile.
        assertThat(get("/players/" + raghavanId, admin).get("user").get("email").asText())
                .isEqualTo("raghavan@sidequest.gg");
        ObjectNode edit = mapper.createObjectNode();
        edit.put("bio", "edited by admin");
        assertThat(patch("/players/" + raghavanId, edit, admin).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        // The owner still can.
        assertThat(patch("/players/" + raghavanId, edit, raghavan).getStatusCode()).isEqualTo(HttpStatus.OK);

        // (b) the account email is never exposed to a spectator.
        assertThat(get("/players/" + raghavanId, null).get("user").hasNonNull("email")).isFalse();

        // (c) username availability: a taken name (case-insensitive) vs a free valid name.
        assertThat(get("/players/username-available?username=raghavan", null).get("available").asBoolean())
                .isFalse();
        String free = "Free" + UUID.randomUUID().toString().substring(0, 6);
        assertThat(get("/players/username-available?username=" + free, null).get("available").asBoolean())
                .isTrue();

        // (d) onboarding is closed for an already-onboarded account.
        ObjectNode onboard = mapper.createObjectNode();
        onboard.put("gamerTag", free);
        assertThat(post("/players/onboard", onboard, raghavan).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // (e) a username with spaces is rejected at registration (the no-spaces rule, end-to-end).
        ObjectNode spaced = mapper.createObjectNode();
        spaced.put("name", "Has Space");
        spaced.put("email", "spaced-" + UUID.randomUUID().toString().substring(0, 6) + "@sidequest.gg");
        spaced.put("password", "password123");
        assertThat(post("/auth/register", spaced, null).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    /**
     * The standing auction pool is visible even without creating/scheduling an auction: {@code
     * GET /auctions/pool} lists the seeded free agents (ghost/pulse/volt), strips private scouting fields
     * (contact/handle/realName) for spectators, and reveals them to admins. Runs at @Order(19), before
     * blitz enters the pool (@Order 25) and before the pool is locked (@Order 46).
     */
    @Test
    @Order(19)
    void auctionPoolVisibleWithoutScheduledAuction() {
        // Spectator (no token): the pool is returned with private fields stripped.
        JsonNode asSpectator = get("/auctions/pool", null);
        int count = asSpectator.get("count").asInt();
        assertThat(count).isGreaterThanOrEqualTo(3); // ghost, pulse, volt at minimum
        JsonNode specPlayers = asSpectator.get("players");
        assertThat(specPlayers.isArray()).isTrue();
        assertThat(specPlayers.size()).isEqualTo(count);
        for (JsonNode p : specPlayers) {
            assertThat(p.get("status").asText()).isEqualTo("QUEUED");
            assertThat(p.get("gamerTag").asText()).isNotBlank(); // public field present
            assertThat(hidden(p, "contact")).isTrue();           // private field stripped
            assertThat(hidden(p, "realName")).isTrue();
            for (JsonNode e : p.get("expertise")) {
                assertThat(hidden(e, "handle")).isTrue();        // handle is private too
            }
        }

        // Admin: same pool, but private scouting detail (contact) is now present on at least one player.
        String admin = login("admin@sidequest.gg", "password");
        JsonNode asAdmin = get("/auctions/pool", admin);
        assertThat(asAdmin.get("count").asInt()).isEqualTo(count);
        boolean anyContact = false;
        for (JsonNode p : asAdmin.get("players")) {
            if (p.hasNonNull("contact") && !p.get("contact").asText().isBlank()) {
                anyContact = true;
            }
        }
        assertThat(anyContact).as("admin sees at least one player's private contact").isTrue();
    }

    /**
     * Game-popularity voting: my-votes needs a session; a save (PUT full-set replace) raises the game's
     * vote-derived popularity and records the vote; re-saving the same set is idempotent; clearing the
     * vote lowers popularity again; anonymous saves are rejected.
     */
    @Test
    @Order(50)
    void gamePopularityVoting() {
        String blitz = login("blitz@sidequest.gg", "password");

        // Brawlhalla — a lower-popularity demo title to move.
        String gameId = null;
        for (JsonNode g : get("/games", null)) {
            if ("Brawlhalla".equals(g.get("name").asText())) {
                gameId = g.get("id").asText();
            }
        }
        assertThat(gameId).isNotNull();

        // my-votes requires a session.
        assertThat(getResp("/games/my-votes", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // Save blitz's votes = just this game; popularity > 0 afterwards and the vote is recorded.
        ObjectNode save = mapper.createObjectNode();
        save.putArray("gameIds").add(gameId);
        ResponseEntity<String> saved = put("/games/votes", save, blitz);
        assertThat(saved.getStatusCode()).isEqualTo(HttpStatus.OK);
        int popAfter = popularityOf(parse(saved), gameId);
        assertThat(popAfter).isGreaterThan(0);
        assertThat(votedIds(get("/games/my-votes", blitz))).contains(gameId);

        // Idempotent: saving the exact same set again yields the same popularity.
        assertThat(popularityOf(parse(put("/games/votes", save, blitz)), gameId)).isEqualTo(popAfter);

        // Clearing blitz's votes drops this game's popularity below what it was with his vote.
        ObjectNode clear = mapper.createObjectNode();
        clear.putArray("gameIds"); // empty set
        int popCleared = popularityOf(parse(put("/games/votes", clear, blitz)), gameId);
        assertThat(popCleared).isLessThan(popAfter);
        assertThat(votedIds(get("/games/my-votes", blitz))).doesNotContain(gameId);

        // Anonymous save is rejected.
        assertThat(put("/games/votes", save, null).getStatusCode())
                .isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
    }

    private int popularityOf(JsonNode gamesArray, String gameId) {
        for (JsonNode g : gamesArray) {
            if (gameId.equals(g.get("id").asText())) {
                return g.get("popularity").asInt();
            }
        }
        return -1;
    }

    private List<String> votedIds(JsonNode myVotes) {
        List<String> ids = new java.util.ArrayList<>();
        for (JsonNode id : myVotes.get("votedGameIds")) {
            ids.add(id.asText());
        }
        return ids;
    }

    /**
     * The league admin (a User with no Player) can set an account-level avatar: upload → PATCH → it shows
     * in /auth/me's user view. Non-admins are blocked; a non-media URL is rejected; blank clears it.
     */
    @Test
    @Order(51)
    void adminAccountAvatar() {
        String admin = login("admin@sidequest.gg", "password");
        String raghavan = login("raghavan@sidequest.gg", "password");

        // A non-admin cannot use the admin avatar endpoint.
        ObjectNode anyBody = mapper.createObjectNode();
        anyBody.put("avatarUrl", "/media/whatever");
        assertThat(patch("/admin/profile/avatar", anyBody, raghavan).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        // Upload a real PNG → get a /media/{id} ref, then set it as the admin's avatar.
        ObjectNode img = mapper.createObjectNode();
        img.put("data", PNG_1x1);
        img.put("kind", "avatar");
        String mediaUrl = parse(post("/media", img, admin)).get("url").asText();
        assertThat(mediaUrl).startsWith("/media/");
        ObjectNode set = mapper.createObjectNode();
        set.put("avatarUrl", mediaUrl);
        assertThat(patch("/admin/profile/avatar", set, admin).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // It now appears on the admin's /auth/me user view (the admin has no player, so it lives on user).
        JsonNode me = get("/auth/me", admin);
        assertThat(me.get("user").get("avatarUrl").asText()).isEqualTo(mediaUrl);

        // A non-/media URL is rejected (no arbitrary external URLs).
        ObjectNode bad = mapper.createObjectNode();
        bad.put("avatarUrl", "https://evil.example.com/x.png");
        assertThat(patch("/admin/profile/avatar", bad, admin).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Blank clears it.
        ObjectNode clear = mapper.createObjectNode();
        clear.put("avatarUrl", "");
        assertThat(patch("/admin/profile/avatar", clear, admin).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(get("/auth/me", admin).get("user").hasNonNull("avatarUrl")).isFalse();
    }
}
