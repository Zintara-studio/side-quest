# Setup & running

How to install, configure, build, and run the Side Quest frontend (`esports-arena`) — a Next.js 15 /
React 19 / TypeScript client for the Side Quest esports league.

**See also:** [../README.md](../README.md) · [./architecture.md](./architecture.md) ·
[./tech-stack.md](./tech-stack.md) · [./data-and-state.md](./data-and-state.md) ·
[./testing.md](./testing.md) · [./troubleshooting.md](./troubleshooting.md) ·
[../CLAUDE.md](../CLAUDE.md)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **20+** | The `Dockerfile` pins `node:20-alpine`; newer LTS (22) works too. |
| npm | 10+ | Ships with Node 20/22. The repo commits `package-lock.json` — use `npm`, not yarn/pnpm. |
| Backend | running at `/v1` | This is a **real client** — it reads and writes the live Spring Boot API. Nothing renders without it. See [`../SideQuests arena backend`](../../SideQuests%20arena%20backend). |

There is no separate global tooling to install — everything (Next, TypeScript, ESLint, Tailwind) is a
project dependency.

---

## Install

```bash
npm install
```

Installs the runtime deps (`@tanstack/react-query`, `axios`, `zustand`, `react-markdown` + `remark-gfm`,
`lucide-react`, `clsx`, `tailwind-merge`) and dev deps (`tailwindcss` + `postcss` + `autoprefixer`,
`eslint` + `eslint-config-next`, `typescript`, `@types/*`). Full inventory and rationale in
[./tech-stack.md](./tech-stack.md).

---

## Configure the environment

Two variables, both `NEXT_PUBLIC_*` (so both are **inlined into the client bundle at build time** — see
the [build-time warning](#the-build-time-env-trap) below). Copy the example and edit:

```bash
cp .env.example .env.local
```

| Variable | Default (`.env.example`) | What it is |
|----------|--------------------------|------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/v1` | Base URL of the Spring Boot API (`server.port` 8080 + context-path `/v1`). **Must be reachable from the visitor's browser**, not just from the Node server. WebSocket URLs are derived from this and keep the `/v1` path (see below). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | *(empty)* | Google Sign-In web client id. **Leave empty** to hide the Google button — the email/OTP flow works without it. |

`.env.local` is git-ignored (`.gitignore` excludes `.env*.local` and `.env`).

### The build-time env trap

`NEXT_PUBLIC_*` values are substituted into the compiled JavaScript when you build — **not read at
runtime**. Consequences:

- Changing `NEXT_PUBLIC_API_URL` after a build does nothing until you **rebuild**.
- `lib/api/client.ts` guards this at build time: a **production build throws** if `NEXT_PUBLIC_API_URL`
  is unset, is not a valid URL, or uses plain `http://` for a non-localhost host (https is required for
  real deploys; `http` is allowed only for `localhost`/`127.0.0.1` smoke tests). Failing the build is
  deliberate — better than shipping a bundle that silently calls `localhost:8080` from every visitor.
- If the var is missing entirely, the client falls back to `http://localhost:8080/v1` (dev only).

---

## Run in development

```bash
npm run dev        # next dev
```

Serves the app at **http://localhost:3000** and expects the backend at **http://localhost:8080/v1**.
Fast Refresh is on; the floating Next.js dev badge is hidden (`devIndicators: false` in
`next.config.mjs`). `reactStrictMode` is on, so effects run twice in dev — expected.

> **CORS:** the backend must allowlist the exact frontend origin. `http://localhost:3000` is a
> *different* origin from a LAN IP like `http://192.168.1.10:3000` — allowlist whichever origin the
> browser actually loads from. In the root `docker-compose.yml` this is `SIDEQUEST_CORS_ORIGINS`.

---

## Build & run production

The build is configured for **standalone output** (`output: "standalone"` in `next.config.mjs`) — a
self-contained `.next/standalone/server.js` that runs without shipping `node_modules`, sized for a small
EC2/container deploy.

```bash
npm run build            # next build (+ the postbuild hook, below)
npm run start:standalone # node .next/standalone/server.js
```

### Why `postbuild` exists

Next's standalone output does **not** include static assets or `public/` by default. The `postbuild`
script copies them in so the single `server.js` can serve a complete app:

```jsonc
// package.json
"build":     "next build",
"postbuild": "cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static",
```

`npm run build` triggers `postbuild` automatically (npm lifecycle). If you invoke `next build` directly
you must copy those two directories yourself, or the standalone server will 404 on CSS/JS and images.

### Binding the host

The standalone `server.js` reads `HOSTNAME` and `PORT`. It binds `localhost` by default — for LAN or
production you must open it up:

```bash
HOSTNAME=0.0.0.0 PORT=3000 npm run start:standalone
```

> `npm run start` (plain `next start`) also works but serves from `.next/` and needs `node_modules`
> present — `start:standalone` is the intended production path.

---

## Docker

A multi-stage `Dockerfile` (node:20-alpine, build stage + slim runtime) is committed at the frontend
root. Because the API origin is baked into the bundle, it must be passed as a **build arg**, not a
runtime env var:

```bash
# from the frontend directory
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain.com/v1 \
  -t sidequest-frontend .

docker run -p 3000:3000 sidequest-frontend
```

The runtime stage sets `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, runs as the `node` user,
and starts `node server.js` from the copied standalone output.

### Whole stack via docker-compose

The workspace-root [`../../docker-compose.yml`](../../docker-compose.yml) brings up Postgres + backend +
frontend as one prod-like stack:

```bash
cd "../.."          # workspace root (has docker-compose.yml)
docker compose up --build
```

- **frontend** → `http://localhost:3000` (build arg `NEXT_PUBLIC_API_URL=http://localhost:8080/v1`)
- **backend** → `http://localhost:8080` (context-path `/v1`), CORS pre-set to `http://localhost:3000`
- **db** → Postgres 16, host port `5433` (avoids clashing with a host-local Postgres on 5432)
- **mailhog** (optional, `--profile mail`) → catches OTP emails at `http://localhost:8025`

For anything beyond local testing, set a real `SIDEQUEST_JWT_SECRET` and `SMTP_*` (see the compose file
comments).

---

## Realtime & media (things the URL affects)

Both are derived from `NEXT_PUBLIC_API_URL` in `lib/api/client.ts`, so they inherit the build-time
baking:

- **WebSockets** — `wsUrl()` maps `http→ws` / `https→wss` and **keeps the full `/v1` context path**
  (endpoints live under it, e.g. `ws://host/v1/ws/live/auctions/{id}`). Don't strip `/v1`. The auction
  bid room streams over this; spectators poll instead.
- **Uploaded media** — `mediaSrc()` resolves stored `/media/{id}` refs against the **API origin** (not
  the frontend), so images are served by the backend. Absolute `http(s):`/`data:` URLs pass through
  unchanged.

---

## Quality gate (no unit tests)

There is **no automated unit/component test suite**. The quality gate is a typecheck + a real build +
Playwright browser E2E driven ad hoc during development (details in [./testing.md](./testing.md)).

```bash
npm run typecheck   # tsc --noEmit  — full strict typecheck, no output
npm run build       # a real compile + Next's route/prerender gate
npm run lint        # next lint (eslint-config-next)
```

Run `typecheck` and `build` before calling any change done; then drive the affected pages in a browser
(loading/empty/error states, dark/light, console + network, refresh persistence, permissions).

---

## Quick reference

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server (`:3000`) | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| Run standalone | `HOSTNAME=0.0.0.0 npm run start:standalone` |
| Docker build | `docker build --build-arg NEXT_PUBLIC_API_URL=… -t sidequest-frontend .` |
| Full stack | `docker compose up --build` (from workspace root) |

---

## Limitations & gotchas

- **Backend required.** The mock/prototype is fully gone; with no reachable `/v1` API the app renders
  shells and error/empty states only.
- **Rebuild after any `NEXT_PUBLIC_*` change** — runtime env edits are ignored (baked at build time).
- **CORS is a frequent first-run failure** — the origin the browser loads from must be on the backend
  allowlist; `localhost:3000` ≠ a LAN IP.
- **Standalone needs the `postbuild` copy** — invoking `next build` directly (bypassing npm's lifecycle
  hook) yields a server that 404s on static assets.
- **Production builds enforce https** for non-localhost API URLs — the build fails fast otherwise.
