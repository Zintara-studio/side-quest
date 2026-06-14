# Architecture

## 1. Design principles

- **Clean / Hexagonal architecture** per service: domain at the core, ports
  (interfaces) at the boundary, adapters (REST / gRPC / Kafka / JPA / Redis)
  on the outside. Domain knows nothing about Spring or persistence.
- **DDD bounded contexts** map one-to-one with services. A `Player` aggregate
  in `player-service` is *not* the same model as the `Player` projection inside
  `auction-service` — each service owns its data and exposes contracts.
- **Event-driven**: every domain mutation publishes a Kafka event. Other
  services react via consumers and own projections (Database-per-Service).
  No service ever reads another service's PostgreSQL.
- **CQRS where needed**: rankings, analytics, match-history, and auction-history
  use separate read models (Redis ZSET / Elasticsearch / ClickHouse). Writes go
  through PG; reads go through the projection.
- **Saga pattern** for cross-service workflows (auction-win → contract creation
  → wallet debit → roster update → notification). Orchestrator lives in the
  `auction-service` for auction sagas, `tournament-service` for tournament
  sagas. Compensating events on failure.
- **API Gateway** is the only external entry. Services are not exposed to the
  internet. Service-to-service is gRPC + mTLS inside the mesh.

## 2. System map

```
                          ┌────────────────────────────┐
                          │   Clients (Web / Mobile)   │
                          │   Flutter, Web, Admin SPA  │
                          └──────────────┬─────────────┘
                                         │  HTTPS / WSS
                            ┌────────────▼─────────────┐
                            │      API Gateway         │
                            │  Spring Cloud Gateway    │
                            │  (Auth, RateLimit, BFF)  │
                            └──┬────────┬───────┬──────┘
                               │REST    │GraphQL│WS
        ┌──────────────────────┼────────┼───────┼──────────────────────┐
        │                      │        │       │                      │
   ┌────▼─────┐ ┌───────────┐ ┌▼──────┐ │  ┌────▼──────┐ ┌────────────▼───┐
   │ Auth Svc │ │ User Svc  │ │Player │ │  │ Franchise │ │  Tournament    │
   └────┬─────┘ └─────┬─────┘ └───┬───┘ │  └─────┬─────┘ └────┬───────────┘
        │             │           │     │        │            │
   ┌────▼─────────────▼───────────▼─────▼────────▼────────────▼───┐
   │                        Apache Kafka                          │
   │  topics: auth.*, user.*, player.*, franchise.*, tour.*, ...  │
   └──┬────────┬──────────┬─────────┬─────────┬───────────────────┘
      │        │          │         │         │
   ┌──▼──┐ ┌───▼──────┐ ┌─▼──────┐ ┌▼───────┐ ┌▼─────────────────┐
   │Match│ │ Auction  │ │Ranking │ │Notif.  │ │ Analytics        │
   │ Svc │ │ Svc + WS │ │ Svc    │ │ Svc    │ │ (Kafka Streams,  │
   └──┬──┘ └────┬─────┘ └───┬────┘ └────────┘ │  ES, ClickHouse, │
      │        │            │                 │  AI rec)         │
      │        │            │                 └──────────────────┘
   ┌──▼────────▼────────────▼──────────────────────────────────────┐
   │     PostgreSQL (per-service) · Redis · Elasticsearch · S3     │
   └────────────────────────────────────────────────────────────────┘
```

## 3. Per-service architecture (canonical layout)

```
service-name/
├── pom.xml
├── Dockerfile
├── src/main/resources/
│   ├── application.yml             # env-agnostic defaults
│   ├── application-local.yml
│   ├── application-prod.yml
│   └── db/migration/               # Flyway: V1__init.sql ...
└── src/main/java/com/esports/<svc>/
    ├── <Svc>Application.java       # @SpringBootApplication
    │
    ├── config/                     # Beans, Kafka, Redis, OpenAPI, Web, gRPC
    │   ├── KafkaConfig.java
    │   ├── RedisConfig.java
    │   ├── SecurityConfig.java
    │   ├── WebConfig.java
    │   ├── OpenApiConfig.java
    │   └── GrpcServerConfig.java
    │
    ├── controller/                 # ADAPTER: HTTP in
    ├── websocket/                  # ADAPTER: WS in/out
    ├── grpc/                       # ADAPTER: gRPC in
    ├── kafka/                      # ADAPTER: Kafka producers + listeners
    │
    ├── service/                    # APPLICATION layer (use-cases / ports)
    │   ├── XxxService.java         #   port interface
    │   └── impl/XxxServiceImpl.java
    │
    ├── domain/                     # DOMAIN layer (entities, value objects,
    │   ├── model/                  #   aggregates, domain events). No Spring.
    │   ├── event/
    │   └── policy/
    │
    ├── repository/                 # ADAPTER: JPA / Redis / ES out
    ├── entity/                     # JPA entities (persistence model)
    ├── dto/
    │   ├── request/
    │   └── response/
    ├── mapper/                     # MapStruct: entity <-> domain <-> dto
    ├── exception/                  # @RestControllerAdvice
    ├── security/                   # JWT filters, role decisions
    ├── scheduler/                  # @Scheduled / Quartz jobs
    └── util/
```

The package split forces the dependency direction: `controller`, `kafka`,
`grpc`, `websocket`, `repository`, `scheduler` all depend on `service` and
`domain`. `domain` depends on nothing else inside the service.

## 4. Communication patterns

| When                                    | Use            | Why                                   |
|-----------------------------------------|----------------|---------------------------------------|
| Public client → backend                 | REST / GraphQL / WSS | Standard, cache-friendly         |
| Service A → Service B (sync, low-latency, query) | gRPC + mTLS  | Strongly typed, fast              |
| Service A → Service B (async, fact)     | Kafka          | Decoupled, replayable, durable        |
| Server → many clients (live state)      | WebSocket + Redis Pub/Sub | Fan-out + sticky session       |
| One-shot fire-and-forget cross-service  | Kafka          | Never use HTTP for this               |

**Rule**: never call a sibling service synchronously to *react* to an event —
publish/consume Kafka. Reserve gRPC for genuine queries that the caller must
block on (e.g. `auction-service` asking `franchise-service` "does this
franchise have ≥ X in their wallet right now?").

## 5. Data ownership

Each service owns its database (Database-per-Service). Cross-service reads
happen via:

1. **gRPC query** to the owner — for transient point-in-time facts.
2. **Local projection** built from Kafka events — for repeated reads (e.g.
   `auction-service` keeps a slim `player_pool` table built from `player.*`
   topic so it doesn't gRPC on every bid).
3. **Read model** in Redis / ES / ClickHouse — for analytics, rankings, search.

The platform never joins across service databases. There is no shared schema.

## 6. Auction concurrency model (overview — see AUCTION-DEEP-DIVE.md)

```
client bid ─► WS gateway ─► auction-service
                           1. Redis SETNX bid_lock:{auctionId}    (fencing token)
                           2. Lua script: validate + zadd current bid
                           3. PG: insert into bids (idempotency key)
                           4. Kafka: bid.placed
                           5. Redis PUBSUB ─► WS broadcast to room
```

- Per-auction in-process actor (a single virtual-thread worker) drains a
  bounded queue → eliminates intra-node races.
- Redis distributed lock (Redisson `RLock` with fencing) → eliminates
  cross-node races.
- PG `bids` table has `UNIQUE(auction_id, bid_seq)` — final correctness check.
- Timer extension ("anti-snipe") is set by Lua atomically with the bid.

## 7. Scaling strategy

- All services stateless → scale via HPA (CPU + custom Kafka-lag metric).
- WebSocket nodes: sticky sessions via `consistent-hash` on auction/match id;
  cross-node fan-out via Redis pub/sub channels named `auction:{id}`,
  `match:{id}`, `tournament:{id}`.
- PostgreSQL: primary-replica per service, read replicas for hot read paths
  (rankings, history). Partition huge tables (`matches`, `bids`,
  `notifications`) by month or by tournament season.
- Kafka: topic-level partitioning by aggregate id (auctionId, matchId,
  userId) for ordering + parallelism.
- Redis Cluster for caches and locks; separate cluster for pub/sub.
- Multi-region: active-active for read-heavy services (player, ranking,
  community) via geo-routed API gateway + Kafka MirrorMaker 2; active-passive
  for write-authoritative services (auction, payment) per region; users
  pinned to their home region for write traffic.

## 8. Failure isolation

- Circuit breakers (Resilience4j) on every gRPC client.
- Bulkheads: each downstream gets its own thread-pool/virtual-thread group.
- Kafka consumer DLQ topics: `<topic>.dlq` with retry topic `<topic>.retry`
  using exponential backoff.
- Idempotency keys on every state-mutating REST endpoint (`Idempotency-Key`
  header → Redis dedupe with 24h TTL).
- Outbox pattern: services write the domain change and the outgoing event in
  the same PG transaction; a Debezium / outbox-relay process publishes to
  Kafka. Guarantees at-least-once with no dual-write failure modes.
