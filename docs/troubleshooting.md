# Troubleshooting

Common failures running or deploying the Side Quest frontend, each as **symptom → cause → fix**, grounded in the actual code.

**See also:** [./setup.md](./setup.md) · [./data-and-state.md](./data-and-state.md) · [./architecture.md](./architecture.md) · [./testing.md](./testing.md) · [../CLAUDE.md](../CLAUDE.md)

---

## Orientation

The client is Next.js 15 (App Router) / React 19 / TypeScript — 109 `.ts`/`.tsx` files, ~24,790 LOC under `src/{app, components, lib}`. It talks to a Spring Boot backend served at `:8080/v1`; the dev frontend runs at `:3000`. There is **no runtime config** — everything the browser needs about the API is decided by `NEXT_PUBLIC_API_URL` at build time. Most of the failures below trace back to that fact, to the standalone build layout, or to CORS.

Two fast sanity commands before you debug anything:

```bash
npm run typecheck   # tsc --noEmit — catches type/consumer drift
npm run build       # next build (+ postbuild) — catches the env guard and standalone layout
```

---

## 1. App can't reach the API / every request fails

**Symptom.** The UI loads (it's static HTML/JS) but every data call errors, or the network tab shows requests going to `http://localhost:8080/v1` from a machine where that isn't the backend.

**Cause.** `NEXT_PUBLIC_API_URL` is a `NEXT_PUBLIC_*` variable, so Next **inlines it into the client bundle at build time**. `lib/api/client.ts` reads it once:

```ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/v1";
```

Setting or changing the env var at *runtime* (in your shell, a `docker run -e`, a systemd unit) does nothing — the value was already frozen into the JS that ships to the browser. If you built with the default and deployed elsewhere, every visitor's browser calls `localhost:8080`.

**Fix.** Rebuild with the correct **browser-reachable** value baked in:

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com/v1 npm run build
```

For Docker, pass it as a build arg (the `Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` and promotes it to `ENV` before `npm run build`):

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain.com/v1 -t sidequest-web .
```

**Guardrails already in place** (in `client.ts`, all run *at build time* since the module executes during `next build`):

| Condition | Result |
|---|---|
| Production build, var unset | Build fails: `NEXT_PUBLIC_API_URL must be set for a production build`. |
| Var is not a valid URL | Build fails: `NEXT_PUBLIC_API_URL is not a valid URL: "..."`. |
| Production build, non-`https`, non-localhost host | Build fails: `must use https in a production build`. `http` is allowed only for `localhost`/`127.0.0.1` (local prod-mode smoke tests). |

So a *production* build with a bad URL won't silently ship — it stops the build. A **dev** run (`npm run dev`) skips these checks and falls back to `http://localhost:8080/v1`.

> Note the value must include the `/v1` context path. `mediaSrc()` and `wsUrl()` both build on `API_BASE_URL`; drop `/v1` and images and the auction socket break too.

---

## 2. CORS errors in the browser console

**Symptom.** Requests fail with `... has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header ...`, often only after you switch from `localhost` to a LAN IP or a real hostname.

**Cause.** CORS is enforced by the **backend**, not this repo. The API allow-lists exact origins via the `SIDEQUEST_CORS_ORIGINS` environment variable (`application.yml`):

```yaml
cors:
  allowed-origins: ${SIDEQUEST_CORS_ORIGINS:http://localhost:3000,http://localhost:5173}
```

The allow-list is an **exact string match** on scheme + host + port — `http://localhost:3000`, `http://192.168.1.20:3000`, and `https://sidequest.example.com` are three different origins. Because the client sends credentials in the `Authorization` header, the backend uses a credentialed, explicit allow-list (it can't use `*`).

**Fix.** Set `SIDEQUEST_CORS_ORIGINS` on the **backend** to the exact origin the browser uses, comma-separated for multiples:

```bash
SIDEQUEST_CORS_ORIGINS=http://192.168.1.20:3000,https://sidequest.example.com
```

Restart the backend after changing it. Match the port too (`:3000` for `next start`/dev, whatever you expose for the container). If you reach the frontend by IP but listed `localhost`, that's the mismatch.

---

## 3. Standalone server serves no CSS or images (unstyled page)

**Symptom.** Running `node .next/standalone/server.js` (or `npm run start:standalone`) yields a page with no styling, broken fonts, and 404s for `/_next/static/...` and files under `public/`.

**Cause.** `next.config.mjs` sets `output: "standalone"`, which produces a minimal `.next/standalone/server.js` that does **not** include `.next/static` or `public/` by default — Next expects you to copy them in. The `postbuild` script does exactly that:

```json
"postbuild": "cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static"
```

If you ran `next build` directly (not `npm run build`), or `postbuild` failed, those directories are missing and the standalone server has nothing to serve for static assets.

**Fix.** Always build via `npm run build` (which triggers `postbuild`), then run the copied server:

```bash
npm run build
npm run start:standalone   # node .next/standalone/server.js
```

If assets are still missing, confirm the copies landed:

```bash
ls .next/standalone/.next/static   # hashed chunks + CSS
ls .next/standalone/public         # favicon, images, etc.
```

The `Dockerfile` handles this itself — it copies `.next/static` and `public` into the runtime image alongside the standalone output, so you don't run `postbuild` inside the container.

---

## 4. Standalone server only reachable on localhost (not the LAN / other containers)

**Symptom.** The standalone server starts fine but nothing outside the host can connect; it's bound to `127.0.0.1` only.

**Cause.** The Next standalone `server.js` binds to whatever `HOSTNAME` says, defaulting to localhost. Without `HOSTNAME=0.0.0.0` it won't accept connections from the LAN, a reverse proxy on another container, or a load balancer.

**Fix.** Set `HOSTNAME` (and optionally `PORT`) when launching:

```bash
HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
```

The `Dockerfile` already sets `ENV HOSTNAME=0.0.0.0` and `PORT=3000`, so containers are reachable out of the box — this fix is mainly for bare-metal / manual `node server.js` runs.

---

## 5. Auction live updates don't arrive (board only moves on refresh)

**Symptom.** In the bid room, other users' bids don't appear in real time; the board only updates when you refetch. The WebSocket may show as failing to connect in the network tab.

**Cause — one of two.**

1. **The `/v1` context path was stripped from the WS URL.** The WS endpoints are registered *under the API context path*, so the socket URL must be `ws://host/v1/ws/live/auctions/{id}?token=...`. The `wsUrl()` helper in `client.ts` deliberately keeps the full base including `/v1` and only swaps the scheme (`http→ws`, `https→wss`):

   ```ts
   export function wsUrl(path: string): string {
     const base = API_BASE_URL.replace(/^http/i, "ws");
     return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
   }
   ```

   If `NEXT_PUBLIC_API_URL` was set **without** `/v1`, the socket points at `/ws/live/...` and never connects. `lib/query/use-auction-socket.ts` calls `wsUrl(\`/ws/live/auctions/${auctionId}?token=${...}\`)` — the auth token rides in the query string because browsers can't set WS headers.

2. **You're a spectator — and spectators intentionally poll.** `useAuctionSocket({ auctionId, enabled })` is only enabled for **bidders** (participating franchise owners/managers) and admins. Spectators pass `enabled: false` and stay on the TanStack Query poll that fills the same `["auctions", id]` cache. That's by design, not a bug — a spectator seeing bids a second or two late is acceptable and avoids fanning every socket out to read-only viewers.

**Fix.**
- Ensure `NEXT_PUBLIC_API_URL` ends in `/v1` and rebuild (see §1). `wss://` is derived automatically when the API base is `https`.
- If a bidder still doesn't get frames, check the token: the socket reads `authTokens.getAccess()` fresh on **each** connect attempt (tokens rotate), retries every 1 s until a token exists, heartbeats a `ping` every 25 s so idle proxies don't close it, and reconnects with capped exponential backoff (`min(1000 · 2^attempts, 15000)` ms). A proxy that doesn't allow WS upgrades on `/v1/ws/...`, or drops idle connections faster than 25 s, will break it — allow the upgrade path and don't set an aggressive idle timeout.
- Confirm the message shape: only frames with `{ event: "auction.update", data: ... }` are written into the cache; anything else is ignored.

---

## 6. Stale Next generated types after deleting or renaming a route

**Symptom.** After removing a `page.tsx`/route folder, `npm run typecheck` or `next build` complains about a route or `PageProps`/typed-link that no longer exists, referencing files under `.next/types/`.

**Cause.** Next generates route-typing helpers into `.next/types/` and doesn't always prune entries for routes you deleted, so `tsc` still sees a ghost route.

**Fix.** Clear the generated types and rebuild:

```bash
rm -rf .next/types && npm run build   # or: rm -rf .next && npm run build
```

Nuking the whole `.next` directory is the bigger hammer if a plain `.next/types` clear doesn't settle it.

---

## 7. 401 loops / kicked back to login unexpectedly

**Symptom.** Requests 401 repeatedly, or you're bounced to `/login` mid-session.

**Cause.** The access token lives **in memory only** (`authTokens.getAccess()` reads it from the zustand store; only the refresh token is persisted to `localStorage`). The axios interceptors in `client.ts` handle the normal case automatically:

- On a request with no in-memory access token but a stored refresh token, the request interceptor mints a fresh access token *first* (via a single shared in-flight `/auth/refresh`) instead of firing unauthenticated.
- On a `401` response, the response interceptor rotates the refresh token once (`_retried` guard prevents infinite retry) and replays the original request with the new token.

The loop only persists when the **refresh token itself is dead** — expired, revoked, or rotated away on the server. In that case `rotateRefreshToken()` catches the failed `/auth/refresh`, calls `authTokens.clear()`, and returns `null`, so the request can't be re-authorized.

**Fix.** This is expected behavior for an expired session — **sign in again** to mint a new token pair. If it happens immediately after a valid login:
- Confirm the backend's JWT secret/clock and refresh-token store didn't reset between login and the next call.
- Check that `localStorage` isn't being cleared (incognito teardown, privacy extension) between requests, which would drop the refresh token.
- A `401` on `/auth/refresh` specifically means the refresh token is invalid server-side — re-login is the only path.

---

## Quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| All API calls fail / hit `localhost:8080` | `NEXT_PUBLIC_API_URL` baked at build time | Rebuild with the right value (`--build-arg` for Docker) — §1 |
| `blocked by CORS policy` | Backend origin allow-list doesn't include this exact origin | Set `SIDEQUEST_CORS_ORIGINS` on the backend, restart — §2 |
| Standalone page unstyled, `/_next/static` 404s | `.next/static` + `public/` not copied into standalone | Build via `npm run build` (runs `postbuild`) — §3 |
| Standalone unreachable off localhost | Binds to `127.0.0.1` | `HOSTNAME=0.0.0.0 node server.js` — §4 |
| Auction board doesn't live-update | `/v1` stripped from WS URL, or you're a spectator (polls) | Keep `/v1`; sockets are bidders/admins only — §5 |
| Build errors about a deleted route | Stale `.next/types` | `rm -rf .next/types && npm run build` — §6 |
| Repeated 401 / forced re-login | Dead refresh token (interceptor can't rotate) | Sign in again — §7 |

---

## Limitations of this guide

- There is **no automated unit/component test suite** — the quality gate is `tsc --noEmit` + `next build` + ad-hoc Playwright E2E. If a page misbehaves, the fastest signal is the browser console + network tab, not a failing test.
- CORS, JWT/refresh-token validity, and the WebSocket endpoints are all **backend-owned**. This client renders and calls; when the root cause is server-side (see §2, §5, §7), fix it in the backend repo (`../SideQuests arena backend`).
- Everything the browser needs is fixed at **build time**. When in doubt about an environment mismatch, rebuild before you debug further.
