# Esports Arena Backend

The operating system of the esports ecosystem — a multi-game platform supporting
franchises, tournaments, player auctions, analytics, rankings, contracts, and
real-time esports operations.

## Repo layout

```
.
├── docs/                # Architecture, schema, API, security, ops blueprints
├── services/            # 15 Spring Boot microservices (polyrepo-friendly monorepo)
├── libs/                # Shared Java libraries (common, security, kafka-events, grpc-proto)
├── infra/
│   ├── docker/          # Local compose stack (Postgres, Redis, Kafka, ES, etc.)
│   └── k8s/             # Helm + raw manifests for staging/prod
├── scripts/
└── .github/workflows/   # CI/CD pipelines
```

## Services

| Service                | Port | Persistence            | Sync API     | Async       |
|------------------------|------|------------------------|--------------|-------------|
| api-gateway            | 8080 | -                      | REST/GraphQL/WS | Kafka    |
| auth-service           | 8081 | PG (auth)              | REST + gRPC  | Kafka       |
| user-service           | 8082 | PG (users) + Redis     | REST + gRPC  | Kafka       |
| player-service         | 8083 | PG (players) + ES      | REST + gRPC  | Kafka       |
| franchise-service      | 8084 | PG (franchises)        | REST + gRPC  | Kafka       |
| tournament-service     | 8085 | PG (tournaments)       | REST + gRPC  | Kafka       |
| match-service          | 8086 | PG (matches) + ES      | REST + gRPC + WS | Kafka   |
| auction-service        | 8087 | PG + Redis (locks/pubsub) | REST + WS | Kafka       |
| ranking-service        | 8088 | PG + Redis (ZSET)      | REST + gRPC  | Kafka       |
| analytics-service      | 8089 | ES + ClickHouse + S3   | REST/GraphQL | Kafka Streams |
| notification-service   | 8090 | PG + Redis             | REST         | Kafka       |
| community-service      | 8091 | PG + ES                | REST/GraphQL | Kafka       |
| media-service          | 8092 | PG + S3/GCS            | REST         | Kafka       |
| payment-service        | 8093 | PG (PCI-isolated)      | REST         | Kafka       |
| ai-recommendation-service | 8094 | Vector DB + S3      | REST + gRPC  | Kafka       |

## Quick start

```bash
# Bring up infra
docker compose -f infra/docker/docker-compose.yml up -d

# Build all services (multi-module Maven)
./scripts/build-all.sh

# Run a single service locally
cd services/auction-service && ./mvnw spring-boot:run
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture & service map
- [docs/DATABASE.md](docs/DATABASE.md) — PostgreSQL schema, indexes, partitioning
- [docs/API.md](docs/API.md) — REST + GraphQL + WebSocket samples
- [docs/EVENTS.md](docs/EVENTS.md) — Kafka topics + WebSocket event catalog
- [docs/SECURITY.md](docs/SECURITY.md) — authn/authz, RBAC, audit, hardening
- [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) — Docker, K8s, CI/CD, observability
- [docs/AUCTION-DEEP-DIVE.md](docs/AUCTION-DEEP-DIVE.md) — concurrency model for live auctions
