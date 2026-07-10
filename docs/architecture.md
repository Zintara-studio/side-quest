# Architecture

The big picture of the Side Quest frontend: a Next.js 15 App Router client that renders the public league and the admin control room from one codebase and talks to the real Spring Boot backend at `/v1`.

**See also:** [./structure.md](./structure.md) · [./data-and-state.md](./data-and-state.md) · [./routes.md](./routes.md) · [./design-system.md](./design-system.md) · [./tech-stack.md](./tech-stack.md) · [./setup.md](./setup.md) · [../CLAUDE.md](../CLAUDE.md)

---

## What this is

`esports-arena` (package name) is a Next.js **15** / React **19** / TypeScript client. It is a pure API
consumer — no server-side data logic, no business rules. The league's rules live in the backend; this
app renders what the API returns and calls back into it. The earlier mock prototype was fully replaced:
there is no `src/lib/mock/*` anymore, and the dependency list is deliberately small (see
[./tech-stack.md](./tech-stack.md)).

Size, as measured in-tree:

| Metric | Value |
|--------|-------|
| `.ts` / `.tsx` files | 109 |
| Lines of code | ~24,790 |
| `src/app` | 45 files (routes + layouts) |
| `src/components` | 50 files (screens + shared UI) |
| `src/lib` | 14 files (data, auth, query, theme) |
| Public screens | 15 (`components/sidequest/screens`) |
| Admin screens | 13 (`components/admin/screens`) |

The centre of gravity is the **shell + screen** split (below) and the **data layer** (`lib/`), not the
routes themselves — route files are intentionally thin.

---

## The two shells

One codebase serves three surfaces, separated by Next.js **route groups** under `src/app`:

| Surface | Route group / path | Layout wraps children in | Who |
|---------|--------------------|--------------------------|-----|
| Public league | `(site)` → mounted at `/` | `LeagueShell` | Anonymous fans + signed-in players/owners/managers |
| Admin control room | `/admin/*` | `AdminShell` | `ADMIN` role only |
| Auth flows | `(auth)` → `/login`, `/signup`, `/verify-email`, `/forgot-password` | a bare centred `AuthLayout` (no shell) | Unauthenticated |

The `(site)` and `(auth)` group names are parentheses so they **don't** appear in the URL — `(site)/page.tsx`
is `/`, `(site)/players/page.tsx` is `/players`. `/admin` is a real path segment with its own layout.

### `LeagueShell` — `components/sidequest/league-shell.tsx`

A `"use client"` component rendering the sticky top nav (Home / Games / Franchises / Players / Matches /
Announcements, plus **My Team** and **My Franchise** for signed-in non-admins), the `NotificationBell`,
the `ThemeToggle`, the identity/sign-in cluster, and a pinned footer. It:

- derives the active tab from `usePathname()` via a small `activeKey()` matcher;
- pulls the live season (`useCurrentSeason`) for the season code chip and footer tagline, falling back to
  an "OFF-SEASON" label;
- computes per-tab unread badges from the notification feed (`useNotifications`) by notification `type`;
- **bounces admins to `/admin`** once auth has hydrated (`useEffect` → `router.replace("/admin")`) so an
  admin never lands on the fan site.

The auction has **no** nav tab — it surfaces contextually (home page for fans, franchise page for
owners/managers) only while one is live.

### `AdminShell` — `components/admin/admin-shell.tsx`

A `"use client"` component with a fixed 244px sidebar (nav grouped LEAGUE / ENTITIES / COMMS / SYSTEM), a
sticky top bar, and the main content region. It:

- **protects every `/admin` route**: on hydration, a non-admin is redirected to
  `/login?next=<path>` (`router.replace`), and until `hydrated` it renders a "Checking access…" gate
  rather than flashing admin chrome;
- drives live sidebar badges from real queries — pending **FRANCHISE** proposals
  (`useRegistrations({ status: "PENDING" })`), `openDisputes` and `resultsToEnter`
  (`useAdminOverview`), and a pulsing **LIVE** pill when `useActiveAuction().data.status === "LIVE"`.

Both shells re-use the same `SQ.*` / `FONT.*` tokens, the shared `NotificationBell`, `ThemeToggle`, and
`ConfirmModal` — the admin surface is a different layout over the **same** design system, not a fork.

---

## Server vs client components

The App Router default is a **Server Component**. The convention here:

- **`page.tsx` is a thin Server Component.** It typically does two things: export `metadata` (for the
  `<title>`) and render the matching client screen. Example — `(site)/players/page.tsx`:

  ```tsx
  export const metadata: Metadata = { title: "Players" };
  export default function LeaguePlayersPage() {
    return <PlayersScreen />;
  }
  ```

  Some pages are one line (`(site)/page.tsx` → `<HomeScreen />`). No data fetching happens in `page.tsx`.

- **Screens are `"use client"`.** All interactivity, data fetching (via hooks), and state live in
  `components/{sidequest,admin}/screens/*`. This is where the app actually is.

- **Layouts** — the root `app/layout.tsx` is a Server Component that wires `next/font`, global metadata,
  the pre-paint theme script, and mounts `<Providers>`. The `(site)` and `admin` layouts are also Server
  Components whose only job is to wrap `children` in the (client) shell.

Why this shape: keep the server/client boundary at the page→screen seam. Pages stay cheap and cacheable;
everything stateful is one clearly-marked client tree. There is **no** server data fetching or React
Server Component data flow here — all data is client-fetched through TanStack Query. (`src/app/api` exists
but is empty; there are no route handlers.)

---

## Data flow

Screens never call `axios` or `fetch` directly. Every read/write goes:

```
                          ┌────────────────────────── Browser ──────────────────────────┐
                          │                                                              │
   URL  ─▶  app/**/page.tsx (Server) ─▶ Shell layout (client) ─▶ Screen (client)         │
                                                                    │                     │
                                                                    │ calls hook          │
                                                                    ▼                     │
                                              lib/query/hooks.ts  (TanStack Query)         │
                                              useQuery / useInfiniteQuery / useMutation    │
                                              keys via `qk`, per-domain staleTimes         │
                                                                    │                     │
                                                                    ▼                     │
                                              lib/api/endpoints.ts  (typed per-domain fns) │
                                                                    │                     │
                                                                    ▼                     │
                                              lib/api/client.ts  (axios `api` instance)    │
                                              • Bearer access token from zustand           │
                                              • 401 → refresh-token rotation → retry once   │
                                                                    │                     │
   DTOs ◀── lib/adapters (DTO → display shape) ◀──────────────── response                 │
     │                                                              │                     │
     └─▶ screen renders                                             │                     │
                          └───────────────────────────────────────┼─────────────────────┘
                                                                    ▼
                                              Spring Boot backend  http://<host>:8080/v1
```

1. **Hooks — `lib/query/hooks.ts`.** Nearly all TanStack Query hooks live here. Keys come from a single
   `qk` factory (e.g. `qk.player(id)` → `["players", id]`) so mutations can invalidate precisely. Cache
   freshness is tuned per domain over the global 30s default: `STALE_STATIC` (10m) for catalog data like
   games/seasons, `STALE_SEMI` (3m) for directories and standings, `STALE_LIST` (1m) for filtered lists
   and admin badges. Every mutation invalidates the keys it touches, so the longer windows never surface
   stale data after a write.
2. **Endpoints — `lib/api/endpoints.ts`.** Typed wrappers grouped by domain (`playersApi`, `matchesApi`,
   `auctionsApi`, `authApi`, …). Paths are relative to the `/v1` base baked into the axios instance.
3. **Client — `lib/api/client.ts`.** The shared `axios` instance (auth + refresh, below), plus helpers:
   `mediaSrc()` resolves `/media/{id}` refs to the API origin, `wsUrl()` builds `ws(s)://…/v1/…` URLs,
   and a build-time guard validates `NEXT_PUBLIC_API_URL`.
4. **Types — `lib/api/types.ts`.** Shared TS types mirroring backend DTOs; the contract both sides agree
   on.
5. **Adapters — `lib/adapters/{league,admin}.ts`.** Map raw DTOs onto the display shapes the "Broadcast
   HUD" screens expect (e.g. a `Standing`/`PlayerRow`), supplying neutral placeholders for fields the
   backend doesn't expose. Adapters keep shaping logic out of screens.

**API-change discipline:** when the backend changes, update in order and verify every consumer —
`types.ts` → `endpoints.ts` → `hooks.ts` → consuming screen(s) → typecheck + browser-verify.

---

## Auth

Auth is a **zustand store** (`lib/auth/store.ts`) with a thin React context on top (`lib/auth/context.tsx`).

- **Token storage.** The **access token lives in memory only**; the **refresh token** is persisted to
  `localStorage` (zustand `persist` + `partialize` keeps only `refreshToken`). This is the deliberate XSS
  posture: a stolen `localStorage` yields the refresh token but not a long-lived access token, and the
  access token is re-minted from the refresh token on reload.
- **Silent re-hydration.** On mount, `AuthProvider` checks for a stored refresh token; if present it calls
  `GET /auth/me`, and the axios request interceptor transparently mints a fresh access token first. The
  provider exposes `hydrated` so shells can gate on "auth resolved" and avoid redirect flicker.
- **Refresh-token rotation — `client.ts` interceptors.** A `401` on any request (that has a refresh token
  and hasn't already retried) triggers `POST /auth/refresh`, stores the new session, and **retries the
  original request once**. A **single in-flight refresh** (`refreshing` promise) is shared by all
  concurrent callers so a burst of 401s rotates the token exactly once. On refresh failure the session is
  cleared. A separate interceptor-free `refreshClient` performs the refresh call to avoid recursion.
- **Non-React accessors.** `authTokens.getAccess/getRefresh/setSession/clear` let the axios interceptor
  read and rotate tokens outside React.
- **Route protection** is client-side and lives in the shells: `AdminShell` redirects non-admins to
  `/login?next=…`; `LeagueShell` redirects admins to `/admin`. The `?next=` value is sanitised through
  `safeNextPath()` (`lib/nav.ts`) — same-origin only, rejecting backslash-smuggled off-site URLs.
- **Flows** (`AuthContext`): `login`, `signup` (no session until email verified), `verifyEmail` (OTP →
  session), `googleLogin` (Google id_token verified server-side), `logout` (best-effort server revoke,
  always clears locally). Auth UIs live in `components/sidequest/auth/*`.

---

## Realtime — the auction bid room

The auction board is the only truly live surface. It has two viewer classes:

- **Bidders** — participating franchise **owners/managers**, plus **admins** — open a WebSocket.
- **Spectators** — everyone else (anonymous fans, non-participating users) — **poll**.

`AuctionBidScreen` (`components/sidequest/screens/auction-bid.tsx`) derives eligibility with no extra
hooks: `canBid` (has a participating franchise + is OWNER/MANAGER) or `isAdmin`, while the auction is
`live`. Only then does it enable the socket:

```tsx
useAuctionSocket({ auctionId: activeQ.data?.id, enabled: (canBid || isAdmin) && live });
```

`useAuctionSocket` (`lib/query/use-auction-socket.ts`):

- connects to `wsUrl("/ws/live/auctions/{id}?token=…")` — note the URL **keeps the `/v1` context path**
  (`ws://host/v1/ws/live/auctions/{id}`); `wsUrl()` must not strip it;
- on each `auction.update` frame, writes the payload **straight into the `["auctions", id]` query cache**
  via `qc.setQueryData` — the same cache key `useAuction(id)` polling fills, so the board re-renders with
  no extra request;
- reconnects with **capped exponential backoff** (`min(1000·2^n, 15s)`), reading the freshest token each
  attempt (tokens rotate), and sends a `"ping"` heartbeat every 25s so a proxy doesn't idle-close it;
- tears down cleanly (clears its own `onclose` first so an intentional close doesn't reconnect).

Spectators rely on `useAuction`'s adaptive `refetchInterval`: **1.5s while `LIVE`**, 4s otherwise, and
`false` once `COMPLETED`; it doesn't poll a hidden tab (`refetchIntervalInBackground: false`) and snaps
fresh on refocus. This gives bidders sub-second updates without every fan holding a socket open.

---

## Theming

Hand-rolled, token-driven, **not** a UI kit (there is no Tailwind component library, Radix, etc. — Tailwind
is present but styling is almost entirely inline `style` objects keyed off tokens).

- **Tokens — `components/sidequest/tokens.ts`.** `SQ.*` colours and `FONT.*` families are all CSS custom
  properties (`SQ.red` = `var(--sq-red)`, `FONT.mono` = `var(--font-sq-mono), …`). The admin token file
  re-exports the shared sidequest tokens — one palette, two surfaces.
- **Light/dark.** Two themes — **warm paper** (light) and **warm espresso** (dark). The concrete colour
  values live in `globals.css` under `:root` and `[data-theme="dark"]`. Flipping
  `document.documentElement.dataset.theme` re-themes the entire app; `ThemeToggle`/`useTheme`
  (`lib/theme.tsx`) do the flip and persist the choice to `sq-theme` in `localStorage`.
- **No flash.** `app/layout.tsx` injects a tiny pre-paint inline script that reads `sq-theme` (or the
  system `prefers-color-scheme`) and sets `data-theme` before first paint.
- **Fonts** via `next/font/google` — **Archivo** (sans), **Archivo Black** (display), **Spline Sans Mono**
  (mono) — exposed as `--font-sq-*` variables and referenced by `FONT.*`.

See [./design-system.md](./design-system.md) for the token catalogue and component idioms.

---

## Build & deploy shape

- **`output: "standalone"`** (`next.config.mjs`) → `next build` emits a self-contained
  `.next/standalone/server.js`. The `postbuild` script copies `public/` and `.next/static` into the
  standalone dir; `start:standalone` runs `node .next/standalone/server.js`. `reactStrictMode` is on;
  `optimizePackageImports` trims `lucide-react`.
- **`NEXT_PUBLIC_API_URL` is baked at BUILD time** (default `http://localhost:8080/v1`). It is inlined
  into the client bundle, so it must be the **browser-reachable** backend URL, and a runtime change won't
  take — you must rebuild. `client.ts` fails the production build if it's missing, not a valid URL, or
  non-HTTPS (localhost excepted).
- **Docker.** A two-stage `Dockerfile` (`node:20-alpine`) takes `NEXT_PUBLIC_API_URL` as a `--build-arg`,
  runs the standalone build, and serves it with `HOSTNAME=0.0.0.0` on `:3000`.
- **CORS.** The backend's allowlist must include the exact frontend origin (`localhost:3000` is not the
  same origin as a LAN IP).

---

## Limitations / honest notes

- **All route protection is client-side.** Admin/auth redirects happen in the shells after hydration; the
  backend is the real authorization boundary. A user can briefly see the gate screen, and hitting the API
  directly is still enforced server-side — the client redirect is UX, not security.
- **No RSC data fetching / route handlers.** Everything is client-fetched via TanStack Query; `src/app/api`
  is empty. Pages don't stream server data. This trades some initial-load optimisation for a single, simple
  data path.
- **No automated unit/component test suite.** The quality gate is `tsc --noEmit` (`npm run typecheck`) +
  `next build` + ad-hoc Playwright browser E2E during development. See [./testing.md](./testing.md).
- **Adapters paper over DTO gaps.** Fields the backend doesn't expose (games-played, per-player K/D,
  matchday dates, "form" trend) are neutral placeholders in `lib/adapters`, not real data.
