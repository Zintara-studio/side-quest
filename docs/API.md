# API surface

The API Gateway exposes three transports:

- **REST** at `/api/v1/...` — request/response, CRUD, listing.
- **GraphQL** at `/graphql` — aggregated read API (BFF) for clients that join
  data across services.
- **WebSocket** at `/ws/...` — live updates (auctions, matches, notifications).

All REST responses use `application/json` and the envelope:

```json
{ "data": <T> | null,
  "error": { "code": "...", "message": "...", "details": [...] } | null,
  "meta":  { "page": 1, "size": 20, "total": 213 } | null }
```

Pagination: `?page=0&size=20&sort=createdAt,desc`.
Idempotency: any POST that mutates state accepts `Idempotency-Key: <uuid>`.
Versioning: URI version (`/api/v1`); breaking changes bump to `/api/v2`.
Rate limit: per-API-key + per-IP token-bucket at the gateway (Redis).

---

## 1. Auth service

| Method | Path                                | Body                              | Auth |
|--------|-------------------------------------|-----------------------------------|------|
| POST   | /api/v1/auth/register               | {email, password, handle}         | -    |
| POST   | /api/v1/auth/login                  | {email, password, mfa?}           | -    |
| POST   | /api/v1/auth/oauth/{provider}       | {idToken}                         | -    |
| POST   | /api/v1/auth/refresh                | {refreshToken}                    | -    |
| POST   | /api/v1/auth/logout                 | -                                 | JWT  |
| POST   | /api/v1/auth/2fa/enroll             | -                                 | JWT  |
| POST   | /api/v1/auth/2fa/verify             | {code}                            | JWT  |
| POST   | /api/v1/auth/password/forgot        | {email}                           | -    |
| POST   | /api/v1/auth/password/reset         | {token, newPassword}              | -    |
| GET    | /api/v1/auth/sessions               | list of devices                   | JWT  |
| DELETE | /api/v1/auth/sessions/{id}          | revoke device                     | JWT  |

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "ana@example.com", "password": "...", "mfa": "123456" }

200 OK
{ "data": {
    "accessToken":  "eyJhbGciOi...",
    "refreshToken": "rt_8a...",
    "expiresIn": 900,
    "roles": ["PLAYER"],
    "user": { "id": "uuid", "handle": "ana_q" }
}}
```

## 2. Player service

| Method | Path                                  | Notes                       |
|--------|---------------------------------------|-----------------------------|
| GET    | /api/v1/players                        | filters: game, role, state, country, search |
| GET    | /api/v1/players/{id}                   |                             |
| POST   | /api/v1/players                        | role: PLAYER (self) / ADMIN |
| PATCH  | /api/v1/players/{id}                   |                             |
| GET    | /api/v1/players/{id}/career            |                             |
| GET    | /api/v1/players/{id}/matches           | pagination                  |
| GET    | /api/v1/players/{id}/stats?season=...  |                             |
| POST   | /api/v1/players/{id}/suspend           | ADMIN                       |
| POST   | /api/v1/players/{id}/loan              | FRANCHISE_OWNER             |
| GET    | /api/v1/free-agents?game=VALORANT      |                             |

## 3. Franchise service

| Method | Path                                       | Notes                  |
|--------|--------------------------------------------|------------------------|
| POST   | /api/v1/franchises                          |                        |
| GET    | /api/v1/franchises/{id}                     |                        |
| POST   | /api/v1/franchises/{id}/rosters             |                        |
| POST   | /api/v1/franchises/{id}/rosters/{rid}/members |                      |
| GET    | /api/v1/franchises/{id}/wallet              |                        |
| POST   | /api/v1/franchises/{id}/wallet/topup        | -> payment-service     |
| GET    | /api/v1/franchises/{id}/staff               |                        |
| GET    | /api/v1/franchises/{id}/trophies            |                        |

## 4. Tournament service

| Method | Path                                           | Notes                     |
|--------|------------------------------------------------|---------------------------|
| POST   | /api/v1/tournaments                             | ADMIN / FRANCHISE_OWNER   |
| GET    | /api/v1/tournaments                             | filters                   |
| GET    | /api/v1/tournaments/{id}                        |                           |
| POST   | /api/v1/tournaments/{id}/register               | {teamId}                  |
| POST   | /api/v1/tournaments/{id}/bracket/generate       | format-specific           |
| GET    | /api/v1/tournaments/{id}/fixtures               |                           |
| GET    | /api/v1/tournaments/{id}/standings              | live projection           |

## 5. Match service

| Method | Path                                       | Notes                  |
|--------|--------------------------------------------|------------------------|
| POST   | /api/v1/matches                             |                        |
| GET    | /api/v1/matches/{id}                        |                        |
| POST   | /api/v1/matches/{id}/start                  | referee                |
| POST   | /api/v1/matches/{id}/events                 | play-by-play ingest    |
| POST   | /api/v1/matches/{id}/complete               | result ingest          |
| POST   | /api/v1/matches/{id}/veto                   | map veto step          |
| POST   | /api/v1/matches/{id}/replay                 | multipart upload       |
| POST   | /api/v1/matches/{id}/verify                 | admin                  |
| WS     | /ws/match/{id}                              | live event stream      |

## 6. Auction service

| Method | Path                                       | Notes                       |
|--------|--------------------------------------------|-----------------------------|
| POST   | /api/v1/auctions                            | ADMIN                       |
| POST   | /api/v1/auctions/{id}/lots                  | bulk player pool            |
| POST   | /api/v1/auctions/{id}/start                 | ADMIN                       |
| POST   | /api/v1/auctions/{id}/next-lot              | ADMIN                       |
| POST   | /api/v1/auctions/{id}/pause                 |                             |
| GET    | /api/v1/auctions/{id}                       | summary + current lot       |
| GET    | /api/v1/auctions/{id}/lots/{lotId}          |                             |
| POST   | /api/v1/auctions/{id}/lots/{lotId}/bid      | {amount} + Idempotency-Key  |
| POST   | /api/v1/auctions/{id}/lots/{lotId}/autobid  | {maxAmount}                 |
| POST   | /api/v1/auctions/{id}/retentions            | {franchiseId, playerId, retentionPrice} |
| GET    | /api/v1/auctions/{id}/history               |                             |
| WS     | /ws/auction/{id}                            | live auction events         |

```http
POST /api/v1/auctions/8b../lots/1d../bid
Authorization: Bearer ...
Idempotency-Key: 6f3...

{ "amount": 1250000 }

200 OK
{ "data": {
    "lotId": "1d...",
    "bidSeq": 41,
    "amount": 1250000,
    "leaderFranchiseId": "ff...",
    "endsAt": "2026-05-12T18:34:22Z"
}}

409 CONFLICT  -> stale bid (someone outbid you)
422 UNPROCESSABLE -> insufficient wallet / below increment
```

## 7. Ranking service

| Method | Path                                         | Notes                |
|--------|----------------------------------------------|----------------------|
| GET    | /api/v1/rankings/players?game=&season=&limit=|                      |
| GET    | /api/v1/rankings/franchises?region=          |                      |
| GET    | /api/v1/rankings/mvp?season=                 |                      |
| GET    | /api/v1/rankings/players/{id}/history        | rating curve         |

## 8. Analytics service (mostly GraphQL)

```graphql
query PlayerSynergy($a: ID!, $b: ID!) {
  synergy(playerA: $a, playerB: $b) {
    matchesTogether
    winRate
    avgCombinedKDA
    suggestedRoles
  }
}

query MatchPrediction($matchId: ID!) {
  predict(matchId: $matchId) {
    winnerTeamId
    confidence
    keyFactors { name weight }
  }
}
```

## 9. WebSocket protocol

All WS connections authenticate by passing `Authorization: Bearer ...` during
the upgrade (or `?token=` for browsers that don't allow headers on `WebSocket`).
Frames are JSON:

```json
{ "type": "AUCTION_BID_PLACED",
  "version": 1,
  "ts": "2026-05-12T18:34:22.115Z",
  "data": { "lotId":"...", "amount":1250000, "leader":"...", "endsAt":"..." }}
```

Client → server frames:

```json
{ "type": "SUBSCRIBE", "channel": "auction:8b../lot:1d.." }
{ "type": "BID", "lotId":"1d..", "amount":1300000, "idemKey":"..." }
{ "type": "PING" }
```

Server → client frames: see `docs/EVENTS.md`.

## 10. Error codes

| Code                       | HTTP | Meaning                                |
|----------------------------|------|----------------------------------------|
| `AUTH_INVALID_CREDENTIALS` | 401  | bad password / mfa                     |
| `AUTH_TOKEN_EXPIRED`       | 401  | refresh required                       |
| `AUTH_FORBIDDEN`           | 403  | role check failed                      |
| `VALIDATION_FAILED`        | 422  | per-field details                      |
| `RESOURCE_NOT_FOUND`       | 404  |                                        |
| `CONFLICT_STALE`           | 409  | optimistic-lock conflict, retry        |
| `RATE_LIMITED`             | 429  |                                        |
| `BID_BELOW_INCREMENT`      | 422  | auction-specific                       |
| `BID_INSUFFICIENT_WALLET`  | 422  | wallet check failed at hold time       |
| `AUCTION_NOT_LIVE`         | 409  | lot already sold / not started         |
| `IDEMPOTENT_REPLAY`        | 200  | returned same response as the original |
| `INTERNAL_ERROR`           | 500  | with a trace id                        |
