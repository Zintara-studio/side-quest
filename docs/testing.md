# Testing & verification

How this frontend is checked before a change is called "done." Honest version: there is **no automated
unit or component test suite** — the quality gate is three things run by hand: `tsc --noEmit`, `next build`,
and a Playwright browser pass over the affected pages against a running stack.

**See also:** [./architecture.md](./architecture.md) · [./data-and-state.md](./data-and-state.md) ·
[./setup.md](./setup.md) · [./troubleshooting.md](./troubleshooting.md) ·
[./contributing.md](./contributing.md) · [../CLAUDE.md](../CLAUDE.md)

---

## The state of testing, stated plainly

There are **zero** `*.test.*` / `*.spec.*` files in the repo, and no test runner in `package.json` — no
Jest, Vitest, Cypress, or Playwright-test dependency. Everything under `devDependencies` is build/lint
tooling (`typescript`, `eslint` + `eslint-config-next`, `tailwindcss`, `postcss`, `autoprefixer`, the
`@types/*`). So the quality bar is **not** "the test suite is green." It is:

| # | Gate | Command | What it actually proves |
|---|------|---------|-------------------------|
| 1 | **Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Types line up end-to-end: DTOs in `lib/api/types.ts` → endpoints → hooks → screens. `tsconfig` has `"strict": true`. |
| 2 | **Build** | `npm run build` (`next build`) | Every route compiles, every `page.tsx` server/client boundary is valid, no bad imports, and the build-time env guard passes. This is a *real* gate, not a formality. |
| 3 | **Browser E2E** | Playwright, driven ad hoc | The thing renders and behaves against the real backend: login, navigate, happy + edge paths, console/network clean, dark/light, refresh persistence, permissions. |

Optionally, `npm run lint` (`next lint`, ESLint with `eslint-config-next`) — useful, but not the load-bearing
gate. Types + build catch the failures that matter here.

> **Why no unit tests (yet).** This is a rendering-and-calling client: it holds almost no business logic
> of its own — league rules live in the backend, and this app calls the API and displays what it returns
> (see [../CLAUDE.md](../CLAUDE.md), "Business rules belong to the backend"). The highest-value automated
> tests would be **E2E specs** across the real stack, not isolated component tests. See
> [Future work](#future-work-where-real-tests-slot-in).

---

## Gate 1 — Typecheck (`npm run typecheck`)

```bash
npm run typecheck    # tsc --noEmit
```

This is the fastest and highest-signal gate, because the codebase is deliberately typed **all the way
through one channel**:

```
lib/api/types.ts   (TS mirrors of backend DTOs)
      → lib/api/endpoints.ts   (per-domain funcs, typed args + returns)
      → lib/query/hooks.ts     (useQuery/useInfiniteQuery/useMutation over those funcs)
      → components/*/screens/*.tsx
```

A backend DTO change that isn't reflected in `types.ts` — or a hook whose consuming screen still reads the
old shape — surfaces here as a compile error rather than a runtime blank screen. This is why the
[API-change checklist](../CLAUDE.md#api-change-checklist) ends with a typecheck: `types.ts → endpoints.ts →
hooks.ts → screen(s) → typecheck`.

Run it after **every** change that touches types, hooks, or props. It's seconds, not minutes.

---

## Gate 2 — Build (`npm run build`)

```bash
npm run build             # next build  → .next/standalone (output: "standalone")
npm run start:standalone  # node .next/standalone/server.js
```

`next.config.mjs` sets `output: "standalone"`, so a successful build produces a self-contained
`.next/standalone/server.js` plus static assets. The `postbuild` script copies `public/` and `.next/static`
into `.next/standalone/` so the standalone server can serve them:

```json
"postbuild": "cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static"
```

Two build-specific things worth knowing:

- **The env guard is a build-time gate.** `lib/api/client.ts` throws during `next build` if
  `NEXT_PUBLIC_API_URL` is missing in a production build, isn't a valid URL, or uses plain `http` for a
  non-localhost host. Because `NEXT_PUBLIC_*` is **inlined at build time**, this is the last chance to catch
  a bad API origin — the failure lands in CI/your terminal, not in every visitor's browser. A green
  production build therefore also proves the API URL is well-formed.
- **A production-mode smoke test is worth doing** for changes near the axios client, WebSocket URLs, or
  media/`mediaSrc` resolution, because `next dev` and the standalone server differ. Build, run
  `start:standalone` (bind `HOSTNAME=0.0.0.0` for LAN), and click through.

### Docker path

`Dockerfile` mirrors this: `npm ci` → `NEXT_PUBLIC_API_URL` as a **build arg** (inlined) → `npm run build`
→ a `node:20-alpine` runtime stage that copies `.next/standalone`, `.next/static`, and `public`. Verifying a
container build is the same gate at one more remove:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080/v1 -t sidequest-frontend .
```

---

## Gate 3 — Browser E2E (Playwright, ad hoc)

There are no committed Playwright specs; the browser pass is **driven interactively** (via the Playwright
MCP during development) against a live dev stack. This is the real acceptance gate — the project's
`CLAUDE.md` is explicit: *"Do not claim completion until browser verification succeeds."*

### The standard verification loop

Straight from the project [CLAUDE.md](../CLAUDE.md) testing workflow:

1. **Build the backend** (sibling repo `../SideQuests arena backend`).
2. **Typecheck + build the frontend** (gates 1 and 2 above).
3. **Start both** — backend on `:8080/v1`, frontend on `:3000`.
4. **Open the browser** with Playwright.
5. **Log in** (the app talks to the real backend; there is no mock mode).
6. **Navigate every affected page** — not just the one you changed.
7. **Test happy paths**, then **edge cases**.
8. **Refresh pages** and **verify persistence**.
9. **Verify permissions** (public vs. admin, owner vs. spectator).
10. **Check the browser console** and **network requests**.
11. **Fix**, then **repeat until clean**. Screenshot on failure.

### The checklist per screen

For each affected screen, confirm:

- **Loading / empty / error states** — TanStack Query gives you all three; screens use shared
  `StateNote` / skeletons. Force each: throttle the network, hit an endpoint with no data, kill the
  backend mid-request.
- **Dark and light theme** — the theme is `data-theme`-driven off typed tokens
  (`components/{sidequest,admin}/tokens.ts`), not a UI kit; both must render. Toggle and re-check.
- **Console + network clean** — no React key/hydration warnings, no failed or duplicated requests. Duplicate
  requests usually mean a missing/incorrect `qk` key or a mismatched `enabled` guard.
- **Refresh persistence** — reload mid-flow. The access token is **in-memory only** and re-minted from the
  `localStorage` refresh token by the axios request interceptor, so a signed-in user must **stay** signed in
  across a hard refresh without a flash of the login screen.
- **Permissions** — `SessionUser.role` gates the admin shell; owner/manager vs. spectator gates the auction
  bid room. Verify the unauthorized case actually blocks, not just that the authorized case works.

### Areas that need hands-on E2E (the build can't catch these)

| Area | What only the browser proves |
|------|------------------------------|
| **Auth / token rotation** | `lib/api/client.ts` refreshes on a 401 and retries once, sharing a single in-flight refresh. Verify a stale access token silently rotates and the original request succeeds — and that a dead refresh token cleanly logs out. |
| **Auction bid room (WebSocket)** | `lib/query/use-auction-socket.ts` writes `auction.update` frames into the `["auctions", id]` cache. **Bidders** get live updates; **spectators poll**. Verify a bid from one browser appears live in another bidder's board, and that the socket **reconnects** (capped backoff) after a drop. The WS URL must keep the `/v1` path — a 404/immediate-close usually means it was stripped. |
| **Media / image upload** | Client-side compression (`lib/image.ts`) then a blob to the backend; `mediaSrc()` resolves `/media/{id}` against the **API** origin, not the frontend. Verify uploaded avatars/branding actually render. |
| **Cache invalidation after writes** | Every mutation invalidates its `qk` keys; per-domain `staleTime`s (10m catalog / 3m directories / 1m lists, over a 30s default) lengthen freshness. Verify a create/update/delete reflects immediately in every list/detail that shows it. |
| **Cross-shell consistency** | An admin action (`/admin/*`, `AdminShell`) must show up in the public league (`(site)`, `LeagueShell`) — e.g. entering a match result updates public standings and the match page. |

---

## Running the stack for a verification pass

Minimal loop (two terminals) — see [./setup.md](./setup.md) for full setup:

```bash
# terminal 1 — backend  (sibling repo)
cd "../SideQuests arena backend" && ./mvnw spring-boot:run        # → :8080/v1

# terminal 2 — frontend
npm run dev                                                        # → :3000
```

Or the whole stack (Postgres + backend + frontend) via `../docker-compose.yml`:

```bash
cd .. && docker compose up --build       # frontend :3000, backend :8080
```

**CORS:** the backend allowlist must contain the **exact** frontend origin — `localhost:3000` is not the
same origin as a LAN IP or `127.0.0.1`. A verification pass from a phone on the LAN will fail on CORS until
that origin is added. See [./troubleshooting.md](./troubleshooting.md).

---

## Quick reference

```bash
npm run typecheck        # tsc --noEmit                    (gate 1 — run constantly)
npm run build            # next build → .next/standalone   (gate 2 — before any "done")
npm run start:standalone # node .next/standalone/server.js (prod-mode smoke test)
npm run lint             # next lint (eslint-config-next)  (optional)
npm run dev              # next dev on :3000               (for the browser pass)
```

A change is verifiable-done when **all three gates pass**: typecheck clean, build clean, and a Playwright
pass over every affected page with no console/network errors, correct dark/light rendering, and persistence
holding across a refresh.

---

## Future work — where real tests slot in

The gaps below are honest; nothing here is currently automated.

- **Playwright E2E specs.** The highest-value addition. Codify the loops above as committed specs:
  auth + token rotation, the auction bid room (two-client live update + reconnect), an admin-writes →
  public-reads flow, and the register/withdraw lifecycle. Add `@playwright/test` and a `test:e2e` script;
  run against `docker compose` in CI. This matches how the app is *already* verified — it just makes it
  repeatable and gate-able.
- **Adapter / pure-logic unit tests.** `lib/adapters/*` (DTO → display shape), `lib/nav.ts`
  (`safeNextPath`), `lib/ranks.ts`, `lib/image.ts`, and the `qk` key factory are pure and cheap to test in
  isolation — a small Vitest suite would cover the logic the browser pass doesn't exercise directly.
- **Component tests for shared primitives.** `Modal`, `ConfirmModal`, `StateNote`, `SearchableSelect`,
  `LineupEditor`, `NotificationBell` are reused everywhere; a React Testing Library harness would guard their
  interaction contracts (focus trap, keyboard, empty/error rendering).
- **CI wiring.** Today the gates run locally. A CI job running `typecheck` + `build` on every PR would make
  gates 1 and 2 non-optional; adding the E2E job above completes the picture.

Until those exist, treat **typecheck + build + a disciplined browser pass** as the contract — and don't say
"done" without it.
