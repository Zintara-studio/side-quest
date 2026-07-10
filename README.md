# Side Quest — Frontend

The web app for the **Side Quest** esports league — a **Next.js 15 / React 19 / TypeScript** client that
talks to the [Side Quest backend](../SideQuests%20arena%20backend). It serves two audiences from one
codebase: the **public league** (players, franchises, matches, standings, the live auction) and an
**admin control room** (run seasons, matches, the auction, registrations, disputes).

> This is a real, integrated app — it reads and writes the live backend API. (An earlier mock/prototype
> version is fully gone.) State is server-driven via **TanStack Query**; the auction bid room streams
> over **WebSockets**.

- **~24.8K LOC** across 109 files · **~40 routes** · **28 screens** (15 public + 13 admin)
- Public shell on `/` (route group `(site)`), admin on `/admin`, auth on `(auth)`

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000   (expects the backend at http://localhost:8080/v1)
```

Point it at a backend with `NEXT_PUBLIC_API_URL` (see [`.env.example`](./.env.example)) — **this is baked
in at build time**, so it must be the browser-reachable API URL.

```bash
# production build (self-contained standalone output)
npm run build
npm run start:standalone      # node .next/standalone/server.js  (set HOSTNAME=0.0.0.0 for LAN/prod)
```

```bash
# Docker (API URL is a build arg — inlined into the bundle)
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080/v1 -t sidequest-frontend .
```

Or bring up the whole stack (Postgres + backend + frontend) from `../docker-compose.yml`:

```bash
cd .. && docker compose up --build     # frontend :3000, backend :8080
```

## What's inside

A **route = a thin server `page.tsx` rendering a client screen** in `components/{sidequest,admin}/screens`.
Server state flows through TanStack Query hooks (`lib/query/hooks.ts`) → an axios client
(`lib/api/client.ts`) → the backend `/v1`. Styling is **inline style objects using typed design tokens**
(`SQ.*` / `FONT.*`) — a hand-rolled warm-paper light/dark theme, no UI kit.

| Area | Screens |
|------|---------|
| **Public league** | Home, Games (with public scoring), Franchises + detail, Players + profiles (per-field privacy, profile editor), Matches archive + detail + **live room** + dispute-result, Announcements, **Auction** spectate + **bid room**, Rules, Register/withdraw, My Team + lineups, Notifications |
| **Admin control room** | Overview, Matches (CRUD + result entry + lineups + void/delete), **Auction operator console**, Franchises, Players, Games + scoring, Announcements + edit, Disputes, Registrations, Settings, History (seasons), Notifications |
| **Auth** | Login, Signup, Verify-email (OTP), Forgot-password, Google sign-in |

## Documentation

Layered docs live in [`docs/`](./docs) — start with the [architecture](./docs/architecture.md) and the
[developer guide](./docs/contributing.md):

| Doc | |
|-----|--|
| [architecture.md](./docs/architecture.md) | Shells, data flow, auth, realtime, theming |
| [structure.md](./docs/structure.md) | `src/` tree → responsibility |
| [tech-stack.md](./docs/tech-stack.md) | Every library, version, and why |
| [routes.md](./docs/routes.md) | Every route → shell → screen |
| [data-and-state.md](./docs/data-and-state.md) | TanStack Query, the axios client, the auth store, the auction socket |
| [design-system.md](./docs/design-system.md) | Tokens, theming, component idioms |
| [setup.md](./docs/setup.md) | Install, env, build, Docker |
| [testing.md](./docs/testing.md) | Typecheck + build + Playwright E2E gate |
| [troubleshooting.md](./docs/troubleshooting.md) | Common issues → fixes |
| [status.md](./docs/status.md) | Feature inventory, limitations, roadmap |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · **TanStack Query v5** (server state) · **axios**
(HTTP + refresh-token rotation) · **zustand** (auth tokens) · Tailwind + typed design tokens · `next/font`
· `react-markdown` + `remark-gfm` (announcements) · `lucide-react`. Output `standalone`. Deliberately
*not* used: framer-motion, recharts, radix, react-hook-form, zod (forms are hand-rolled, charts are
inline SVG/CSS).

## Verify

No unit-test suite yet — the quality gate is:

```bash
npm run typecheck     # tsc --noEmit
npm run build         # a real compile + route gate
```

plus Playwright browser E2E driven against a running dev stack (see [docs/testing.md](./docs/testing.md)).
