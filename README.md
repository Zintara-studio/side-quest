# Side Quest

An esports league you can run yourself: players and franchises, a pre-season **live player auction**, match
scheduling with per-round scoring, standings, registrations, disputes and announcements, plus an **admin
control room** that runs the whole season.

| | |
|---|---|
| [`frontend/`](frontend) | Next.js 15 · React 19 · TypeScript · TanStack Query · WebSocket auction room · ~40 routes |
| [`backend/`](backend) | Spring Boot 3 · Java 21 · 118 REST endpoints under `/v1` · OpenAPI · JPA · H2 (dev) or PostgreSQL |

## Try it in two terminals

```bash
# 1. API with an in-memory database and a seeded demo league (Season 04)
cd backend && ./mvnw spring-boot:run          # http://localhost:8080/v1/docs

# 2. The app
cd frontend && npm install && npm run dev       # http://localhost:3000
```

Or the full stack on Postgres: `SIDEQUEST_JWT_SECRET=$(openssl rand -hex 32) docker compose up --build`.

Each folder has its own README with the architecture, the auth model and the deployment notes.

## Who built it

Side Quest was built by **[SammyUrfen](https://github.com/SammyUrfen)** (Bibek Jyoti Charah), with
contributions from Ajij Uttam and Sudarshan Patil. The full commit history of both original repositories
is preserved here.

## Licence

MIT, see [LICENSE](LICENSE). Published with the agreement of all three contributors.
