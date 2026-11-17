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
| `.ts` / `.tsx` files | 120 |
| Lines of code | ~27,720 |
| `src/app` | 50 files (routes + layouts) |
| `src/components` | 55 files (screens + shared UI) |
| `src/lib` | 17 files (data, auth, query, theme) |
| Public screens | 17 (`components/sidequest/screens`) |
| Admin screens | 14 (`components/admin/screens`) |

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

A `"use client"` component with a 244px sidebar (nav grouped LEAGUE / ENTITIES / COMMS / SYSTEM), a
sticky top bar, and the main content region. It:

- **protects every `/admin` route**: on hydration, a non-admin is redirected to
  `/login?next=<path>` (`router.replace`), and until `hydrated` it renders a "Checking access…" gate
  rather than flashing admin chrome;
- drives live sidebar badges from real queries — pending **FRANCHISE** proposals
  (`useRegistrations({ status: "PENDING" })`), `openDisputes` and `resultsToEnter`
  (`useAdminOverview`), and a pulsing **LIVE** pill when `useActiveAuction().data.status === "LIVE"`;
- **collapses responsively**: below `860px` (via `useMediaQuery`, the app's first breakpoint hook,
  `lib/use-media-query.ts`) the sidebar becomes a fixed off-canvas **drawer** toggled by a hamburger in
  the top bar, with a dimmed backdrop; it closes on nav-tap and on route change. Nav items marked
  `superOnly` (Auction, Admins) are hidden from appointed (non-super) admins.

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
- **Session fields.** Beyond the tokens, the store carries `playerId`, `gamerTag`, and **`avatarUrl`**
  (from `/auth/me`), plus an **`onboardingRequired`** flag. `avatarUrl` uses a **player→user fallback**
  (`me.player?.avatarUrl ?? me.user?.avatarUrl`) so the league admin — who has no player — still shows an
  avatar; the nav-bar identity in both shells renders `<Avatar url={avatarUrl}>`.
- **Route protection** is client-side and lives in the shells: `AdminShell` redirects non-admins to
  `/login?next=…`; `LeagueShell` redirects admins to `/admin`. The `?next=` value is sanitised through
  `safeNextPath()` (`lib/nav.ts`) — same-origin only, rejecting backslash-smuggled off-site URLs.
- **Onboarding gate.** A first-time Google account is created without a real username; `onboardingRequired`
  is true until it completes `/onboarding` (pick a username + optional profile). An `OnboardingGuard`
  mounted in `providers.tsx` `router.replace`s any onboarding-required session to `/onboarding` from
  anywhere else, so the app can't be used half-initialised.
- **Flows** (`AuthContext`): `login`, `signup` (no session until email verified; enforces the shared
  username rules with a live availability check), `verifyEmail` (OTP → session), `googleLogin` (Google
  id_token verified server-side; returns `{ role, onboardingRequired }` so the caller can route a new user
  to `/onboarding`), `refreshUser` (re-fetch `/auth/me`, e.g. after onboarding/avatar changes), `logout`.
  Auth UIs live in `components/sidequest/auth/*`.
- **Custom Google button.** GIS's own button can't be token-themed (the "G" always sits on a white tile in
  its locked shadow DOM), so `SocialRow` renders our own theme-styled button and stretches Google's real
  button **transparently on top** (`opacity:0`) to catch the click — same `id_token` flow, no backend
  change, and it adapts to light/dark for free because it's styled with `SQ.*` CSS variables.

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

When **no auction exists**, `AuctionBidScreen` no longer dead-ends — it fetches the standing pool
(`useAuctionPool` → `GET /auctions/pool`) and renders `NoAuctionPool`, a grid of registered players, so
fans can see who signed up before the league schedules the auction.

---

## Pretty URLs (slug resolution)

Public entity links use human-readable slugs, built through `lib/routes.ts`: `playerHref(gamerTag)`,
`franchiseHref(tag)`, `matchHref(slug)`, `announcementHref(shortCode)` (all `encodeURIComponent`). The
backend resolves **either the slug or the raw UUID** at every seam, so pre-existing stored links (a
notification pointing at `/match/{uuid}`, say) still work — the UI just never *builds* UUID URLs anymore.

The one gotcha this creates: any "is this mine?" check must key off the **resolved entity's id**, not the
route param, because a slug (`"Crazy8"`) never equals a UUID. `player.tsx` computes
`isOwner = p.id === playerId` from the loaded DTO, not from the `[gamerTag]` param.

---

## Image uploads & cropping

Avatar / franchise-logo / franchise-banner uploads run entirely client-side, then post a finished image
to `POST /media`:

- **`components/sidequest/image-cropper.tsx`** — an aspect-locked modal (avatar/logo `1:1`, banner `4:1`;
  the avatar frame is a circle). The user **pans** (pointer drag, cover-constrained so the frame is always
  filled) and **zooms** (slider + wheel, centre-preserving). It is WYSIWYG: the preview `<img>` uses the
  same transform the crop reads.
- **`lib/image.ts`** — on Apply, `cropToDataUrl(img, srcRect, outW, outH, maxBytes)` renders the chosen
  region to a canvas at the kind's target size (`CROP_DIMS`) and steps quality/scale down to fit the media
  byte cap, returning a data URL.
- Every upload site (`profile-editor`, `onboarding`, admin `profile` avatar, `my-franchise` branding
  modal) sets a `cropFile` on file-pick and renders `<ImageCropper onCropped={upload}>`. Because the stored
  image already matches its display box, **no display re-crops** — banners show in full at a consistent
  4:1 (`aspectRatio` + `cover`) on the franchise page, my-franchise hero, and the branding preview alike.

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
